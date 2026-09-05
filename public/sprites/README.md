# public/sprites

Normalized character frames. **Everything in here is generated** by
`pnpm sprites:normalize` from a raw art pack — do not hand-edit a PNG or a `manifest.json`; change
the source manifest under `scripts/sprite-sources/` and re-run.

This directory is the one place in the repo where binary assets are allowed (issue #93 relaxes the
M0 no-binaries rule for `public/sprites/` only). **Budget: 2 MB total**, enforced by
`src/ui/sprites/spriteBudget.test.ts`.

## The contract

Every later art issue (#94, #95, #96, #98, #97) reads and writes this shape:

```
public/sprites/<animal>/<pose>_<NN>.png   96x96, RGBA, true alpha
public/sprites/<animal>/manifest.json     poses -> frames, fps, loop, credit
public/sprites/<animal>/LICENSE.txt       copied verbatim from the source pack
```

- **Frame size: 96x96.** Fixed, square, recorded in every `manifest.json` as `frameSize`. Chosen
  over 64x64 because the source art is smooth (not pixel art) and 64 lost the bunny's face; the
  parser still accepts 64 so a genuinely low-res pack later doesn't need a contract change.
- **Frame numbering** is zero-based and two-digit (`move_00.png` ... `move_03.png`), so files sort
  in play order.
- **Required poses**: `idle`, `move` (4+ frames), `hurt`, `celebrate`. The manifest parser rejects a
  manifest that is missing any of them, or whose `move` has fewer than 4 frames.
- **Alignment**: within one animal, all frames share a single scale factor (derived from the largest
  trimmed frame) and are bottom-aligned onto a common baseline row, horizontally centred. Swapping
  poses therefore never makes the character jump or resize.
- **Paths** in `manifest.json` are relative to `basePath` (e.g. `sprites/bunny`), which is relative
  to the deployed site root — the app joins it onto `import.meta.env.BASE_URL`, so it survives the
  GitHub Pages sub-path deploy.

`manifest.json` is imported directly by `src/ui/sprites/bunny.ts`, so there is exactly one copy of
it and no chance of the shipped frames and the app's idea of them drifting apart.

That import matters for offline, too: `vite.config.ts`'s `workbox.globPatterns` precaches `png` but
not `json` or `txt`, so the copies of `manifest.json` and `LICENSE.txt` that land in `dist/sprites/`
are documentation, not runtime dependencies — the manifest the app actually uses is bundled into the
JS. **Do not add a runtime `fetch()` of `manifest.json`** without first adding `json` to
`globPatterns`; it would work online and silently fail offline.

## Animals

### `bunny`

| Field    | Value                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Pack     | Kenney — Jumper Pack                                                                                     |
| Author   | Kenney Vleugels (kenney.nl)                                                                              |
| Page     | https://kenney.nl/assets/jumper-pack                                                                     |
| Download | https://kenney.nl/media/pages/assets/jumper-pack/4654b2d2e5-1677666699/kenney_jumper-pack.zip             |
| License  | CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/ (see `bunny/LICENSE.txt`)          |
| Frames   | `PNG/Players/bunny1_*.png`                                                                               |

**Pose mapping.** The pack's frames do *not* map 1:1 onto our pose names — it ships
`stand / ready / walk1 / walk2 / jump / hurt`, with no dedicated cheer and only a two-frame walk. The
mapping below is declared explicitly in `scripts/sprite-sources/bunny.json`:

| Our pose    | Source frames (in order)                | Why                                                              |
| ----------- | --------------------------------------- | ---------------------------------------------------------------- |
| `idle`      | `stand`, `ready`                        | slow 2 fps bob between upright and crouched — reads as breathing  |
| `move`      | `walk1`, `stand`, `walk2`, `stand`      | the classic 4-step cycle built from a 2-frame walk plus a neutral |
| `hurt`      | `hurt`                                  | single held frame, `loop: false`                                  |
| `celebrate` | `ready`, `jump`, `stand`, `jump`        | crouch → leap → land → leap: a repeating hop                      |

Only `bunny1_*` is used; the pack also ships a `bunny2_*` recolour, kept out for now.

## Re-generating

```bash
curl -L -o /tmp/kenney_jumper-pack.zip \
  'https://kenney.nl/media/pages/assets/jumper-pack/4654b2d2e5-1677666699/kenney_jumper-pack.zip'
unzip -q /tmp/kenney_jumper-pack.zip -d vendor/kenney_jumper-pack
pnpm sprites:normalize scripts/sprite-sources/bunny.json
```

`vendor/` is gitignored — the raw pack is 1.5 MB of art we only need at normalize time.

To normalize art from somewhere else (an image model's output, say), point `--src` at it:

```bash
pnpm sprites:normalize scripts/sprite-sources/<animal>.json --src <dir-or-sheet.png>
```

The script **refuses any frame without an alpha channel** and prints the file name and why. See
`docs/art/prompts.md` for the prompts that get transparent PNGs out of an image model in the first
place.
