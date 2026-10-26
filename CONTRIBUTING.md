# Contributing to Timescaler

## Setup

1. `corepack enable`
2. `pnpm install`
3. `pnpm dev`

To try a dev server from a phone on your Tailscale tailnet, run `pnpm dev --host` and open
`http://<machine>.<tailnet>.ts.net:5173`. `vite.config.ts` allows `*.ts.net` hosts for this.

## Debug pages

`pnpm dev` also serves a few dev-only pages, gated behind `import.meta.env.DEV` and tree-shaken out
of production builds — they're never reachable on the live site, only when running locally:

- `/debug/questions` — every question generator's output at any difficulty/peak, with raw JSON
- `/debug/scene` — the three.js scenes: drive the climb with real `climb.ts` transitions (correct,
  fast correct, miss, fill boost, near summit, fall), switch peak and animal, slow the whole scene
  down (Speed: 1×, ½×, ¼×, ⅒×) to review an animation frame by frame, and preview the overworld
  and the character-pick turntables
- `/debug/widgets` — every answer/display widget (clocks, calendar, choice grid, entry fields)
- `/debug/hud` — the in-climb HUD components (timer, boost/fall-risk meters, profile chip)
- `/debug/screens` — every game screen rendered standalone, for visual QA in isolation
- `/debug/preview` — `PreviewPlayer`, the click-through question-engine preview that used to be the
  production landing page before the real game (`App.tsx`) existed

## Animal models

The six climbers are rigged glTF animals from Quaternius' CC0 "Ultimate Animated Animals" pack,
checked in as optimized copies under `public/models/` (see `CREDITS.md` there). To regenerate them
(for example after changing the roster in `src/scene/animals/roster.ts`):

```bash
pnpm models:prepare
```

The script downloads each source GLB into the gitignored `vendor/models/` once, strips the
duplicate `Armature|Clip` animations, dedups/prunes/welds, resamples the animation curves and
quantizes attributes, and fails if the total goes over 15 MB.

## Before opening a PR

Run the full local check suite (this is what CI runs):

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test:e2e` requires a build to exist first (`pnpm build`), since Playwright serves the built
app via `vite preview`.

## Project layout

See `docs/superpowers/specs/2026-08-08-summit-clock-design.md` for the original design — game
mechanics, the question engine, and the milestone roadmap — and
`docs/superpowers/specs/2026-10-11-3d-climb-design.md` for the three.js scene that replaced its
pixel-art presentation, including the current `src/scene` / `src/ui` layout.
`docs/superpowers/plans/` holds the implementation plan for each milestone.
