# Asset request prompts

The standard prompts used to ask an image model for a Timescaler character, and the command to run
on whatever comes back.

Two rules that are not negotiable, because the normalizer enforces them:

1. **True transparent PNG.** `scripts/normalize-sprites.ts` refuses any frame without an alpha
   channel and prints why. A white or checkerboard "background" baked into the pixels is a reject —
   ask again, do not try to key it out.
2. **Same proportions and palette across every pose.** The normalizer computes **one** scale factor
   for the whole character from its largest frame, so a pose drawn 30% bigger than the others stays
   30% bigger after normalization. Consistency is the model's job, not the script's.

## Prompt A — the first pose (`idle`)

> A single cartoon **{ANIMAL}** climbing character for a children's game, drawn in **side profile**,
> gripping a rock wall with both front paws. Full body, head to feet, facing right. Friendly,
> rounded, chunky shapes — readable as a silhouette at 64 pixels. Flat colours with soft shading, a
> limited palette of 5–6 colours, clean dark outline.
>
> **No background** — fully transparent. **No border, no frame, no ground, no shadow, no text, no
> watermark, no colour swatches.** Output a **true transparent PNG** with a real alpha channel, not
> a white or checkerboard background.
>
> Pose: **idle** — standing on the wall, settled, weight on both feet, looking ahead.

## Prompt B — every following pose

Feed **the previous image back as a reference** on each of these, so proportions, palette, line
weight and camera stay locked. One image per request; do not ask for a sheet.

> Using the attached image as the reference for this exact character — same proportions, same
> palette, same line weight, same side profile, same camera distance — draw the **same character**
> in a new pose. Transparent PNG, no background, no border, no text, no shadow.
>
> Pose: **{POSE}**

| `{POSE}`     | Ask for                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `reach-left` | left front paw stretched up to a new hold, body leaning left             |
| `reach-right`| right front paw stretched up to a new hold, body leaning right           |
| `slip`       | both paws off the wall, body tipping backwards, alarmed but not hurt     |
| `cheer`      | both front paws thrown up above the head, mouth open, delighted          |

Keep `idle`, `reach-left`, `reach-right`, `slip`, `cheer` as the request names — they map onto the
runtime pose names (`idle`, `move`, `hurt`, `celebrate`) in the source manifest, which is where any
renaming belongs. See `public/sprites/README.md` for a worked example of that mapping.

## Prompt C — a repair pass

When one pose comes back off-model:

> The attached second image is meant to be the same character as the first, in the pose
> **{POSE}**, but {WHAT IS WRONG — e.g. "the head is much larger", "the belly colour changed"}.
> Redraw it to match the first image exactly in proportion, palette and line weight, keeping the
> {POSE} pose. Transparent PNG, no background, no border, no text.

## Normalizing the output

Save the returned PNGs into one directory, write a source manifest next to
`scripts/sprite-sources/bunny.json` mapping the files onto poses, then:

```bash
pnpm sprites:normalize scripts/sprite-sources/<animal>.json --src <dir-of-returned-pngs>
```

That writes `public/sprites/<animal>/<pose>_<NN>.png` at the manifest's `frameSize`, all frames
trimmed to their alpha bounding box, scaled by one shared factor and bottom-aligned onto a common
baseline, plus `public/sprites/<animal>/manifest.json` — the contract the runtime reads.

Then check the result by eye against `docs/fun-bar.md` **F12** (silhouette at 64 px) and **F13**
(four nameable poses) on `/debug/sprites`.
