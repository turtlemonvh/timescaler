# Trailer and intro loop

Films the real game and edits the footage into:

| Output                                        | Where it goes                                |
| --------------------------------------------- | -------------------------------------------- |
| `intro-hero.webm` (8 s, 540 px square, mute)  | `public/intro/`, played by the Intro screen  |
| `intro-hero-poster.jpg`                       | `public/intro/`, the reduced-motion still    |
| `timescaler.gif` (the same loop, 420 px)      | `docs/media/`, the README hero               |
| `timescaler-trailer.mp4` (30 s, 1080p, sound) | `out/` only, uploaded as a GitHub attachment |

```sh
pnpm trailer:install   # once, from the repo root (Remotion + Playwright live here, not in the app)
pnpm trailer:render    # record every shot, render all four outputs, copy them into place
```

After a render, upload `trailer/out/timescaler-trailer.mp4` by dragging it into a GitHub comment
or with `gh issue comment <N> --attach`, and replace the trailer link in the root `README.md`.

## How it works

1. **`/debug/trailer?shot=<id>`** (dev server only, `src/ui/debug/DebugTrailerPage.tsx`) plays one
   take: the real `ClimbScene`, `MapScene`, `Climb`, `CharacterPick` and `Summit`, driven by a
   canned script of timeouts. Open it in a browser to watch a take at real speed. The `game` take
   is the real Climb screen on a fixed seed, answered by a scripted player that works out each
   answer from that seed.
2. **`record.ts`** starts Vite, opens each take in headless Chromium with `virtual-time.js`
   injected, and steps the page's clock 1/30 s at a time — timers, `requestAnimationFrame`,
   `performance.now`, CSS animations and Web Audio all run on that clock — saving a JPEG per frame
   and the take's sound as a WAV under `public/shots/<id>/`. Software WebGL is slow, but the
   footage is perfectly smooth because nothing moves between screenshots.
3. **Remotion** (`src/`) cuts the frames together and adds the captions and end card, in the
   game's own font and colours. `pnpm studio` previews the edit.

Shot lengths live in `src/shots.ts`; the edit points live in `src/IntroLoop.tsx` and
`src/Trailer.tsx`. If a scene change shifts the action inside a take, re-record and adjust the
`from` offsets there.
