# Contributing to Timescaler

## Setup

1. `corepack enable`
2. `pnpm install`
3. `pnpm dev`

## Debug pages

`pnpm dev` also serves a few dev-only pages, gated behind `import.meta.env.DEV` and tree-shaken out
of production builds — they're never reachable on the live site, only when running locally:

- `/debug/questions` — every question generator's output at any difficulty/peak, with raw JSON
- `/debug/sprites` — every character pose, palette, and mountain theme
- `/debug/widgets` — every answer/display widget (clocks, calendar, choice grid, entry fields)
- `/debug/hud` — the in-climb HUD components (timer, boost/fall-risk meters, mini-map, profile chip)
- `/debug/climb-stage` — the full-bleed climb stage, with buttons for every move (correct, fast
  correct, miss, fill boost, summit, fall) and a 390 px width toggle
- `/debug/screens` — every M4 screen rendered standalone, for visual QA as each one is built
- `/debug/preview` — `PreviewPlayer`, the click-through question-engine preview that used to be the
  production landing page before the real game (`App.tsx`) existed

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

See `docs/superpowers/specs/2026-08-08-summit-clock-design.md` for the full design — architecture,
game mechanics, and the milestone roadmap. `docs/superpowers/plans/` holds the implementation plan
for each milestone.
