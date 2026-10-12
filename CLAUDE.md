# Working in this repo

Concrete gotchas hit during development, kept here so they don't have to be rediscovered —
especially by a fresh subagent with no prior context on this repo.

## Date/time correctness

- **Always construct dates as `new Date(year, monthIndex, day)` (local time), never by parsing an
  ISO string.** Parsing caused a real DST bug in `randomDate` (M1a) — a UTC/local mismatch made the
  last day of a range unreachable across a spring-forward transition. `vite.config.ts` pins
  `test.env.TZ: 'America/New_York'` specifically so DST edge cases are exercised in CI, not masked
  by a UTC test runner.
- **`date-fns`'s `addMonths` clamps at month-end** (e.g. "1 month after Aug 31" → Sep 30). Any code
  that adds a whole month to a date drawn with an unconstrained day-of-month can silently produce an
  answer with no correct arithmetic inverse. `offsetDate.ts` works around this by clamping the start
  day to ≤28 whenever `unit === 'month'` — follow the same pattern for any new month-arithmetic code.
- **A wrongly-graded question is the worst bug class in this project.** When adding or changing a
  question generator, re-derive the correct answer independently from the question's own display
  data (not from the generator's internal state) in at least one test — see
  `src/engine/questions/contract.test.ts` for the pattern.

## Question engine

- **Individual generators don't read `ctx.peak`** for their own content — peak _exclusivity_ lives
  entirely in `registry.ts`'s `selectGenerator`, which draws only from generators on-theme for
  `ctx.peak` (per `peakEmphasis.ts`) — an off-theme generator is never drawn at all, full stop — with
  `answerModeWeights` governing the mix among a peak's on-theme set. Any UI that iterates
  `BUILT_IN_QUESTION_TYPES` directly instead of going through `selectGenerator`/`generateQuestion` —
  e.g. `generateQuestionBatch`, which the debug and preview pages use so every generator stays
  inspectable regardless of peak — bypasses that exclusivity entirely and shows _every_ type no
  matter which peak is selected; only its internal peak-derived seed mixing makes the _sampled
  values_ vary by peak. Don't assume changing peak ID alone does anything in code that takes this
  shortcut; if you need genuine per-peak type variation there too, mix `peakId` into the RNG seed
  explicitly (see `peakSeed` in `src/engine/questions/preview.ts`).
- Always import from the `src/engine/questions` barrel (`./index`), never `./registry` directly —
  the barrel is what actually registers the built-in generators as a side effect of being imported.

## 3D scenes (three.js / react-three-fiber)

- **Nothing outside `src/scene/` imports `three`.** Screens pass the engine's numbers plus the last
  `ClimbMove` (from `src/scene/climb/motion.ts`, derived from a before/after `ClimbState` pair) and
  the scene renders. If a scene needs a new fact, add it to the props, don't reach into the engine.
- **jsdom has no WebGL, so `src/setupTests.ts` mocks the three scene entry points**
  (`ClimbScene`, `MapScene`, `AnimalShowcase`) with DOM stubs that expose their props as data
  attributes. Screen tests assert `data-move`, `data-position`, `data-phase` etc. on those stubs.
  Anything new under `src/scene/` that a screen imports directly needs a stub there too, or every
  screen test will try to create a WebGL context and fail.
- **The react-hooks lint rules (React Compiler mode) are strict about refs and hook results.** Props
  that carry refs must be named `*Ref` or writes to `.current` are flagged; mutating a hook's return
  value (e.g. an `AnimationAction` from `useAnimations`) is flagged unless the mutation happens in a
  plain function outside the component (see `src/scene/animals/actionConfig.ts`); `setState` inside
  a `useEffect` body is flagged — the scenes detect prop changes inside `useFrame` instead (see
  `Climber.tsx`). Scratch `THREE.Vector3`s live at module scope, not in `useMemo`.
- **Don't use drei's `<Html>` for in-scene labels.** Its DOM portal crashed with "removeChild: the
  node to be removed is not a child" when the Map scene unmounted during a screen change. Peak
  numbers are canvas-texture sprites instead (`NumberBadge` in `MapScene.tsx`).
- **Quaternius animals face +Z**; `rotation.y = +π/2` turns them to face +X. Every clip exists twice
  in the raw packs (`Walk` and `AnimalArmature|Walk`); `scripts/prepare-models.ts` strips the
  prefixed copies. Clip spelling varies per animal (`Jump_ToIdle` vs `Jump_toIdle`), which is why
  `clips.ts` resolves poses from candidate lists case-insensitively.
- **Capturing screenshots:** the chrome-devtools MCP browser is often held by another session
  ("already running for ... chrome-profile"). A plain Playwright script against the dev server
  works (`chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`
  renders WebGL headless). Kill the `vite --port <N>` you started when done.

## TypeScript project split

- `tsconfig.app.json` (covers `src/`) uses `moduleResolution: "bundler"` — relative imports have no
  extension (`from '../peaks'`).
- `tsconfig.node.json` (covers `vite.config.ts` and `scripts/`) uses `module: "nodenext"`, which
  _requires_ explicit `.js` extensions on relative imports.
- **A file under `scripts/` that imports directly from `src/` pulls the entire reachable import
  graph into the nodenext-resolution program**, and `tsc -b` will then demand `.js` extensions on
  every file in that graph — cascading far beyond the one file you touched. Don't "fix" this by
  adding extensions throughout `src/`; instead keep the script excluded from `tsconfig.node.json`
  (see the `exclude` entry there) and let `tsx` run it unchecked, same as the other scripts in that
  directory.

## GitHub / CI quirks

- **Dependabot PRs always show a `claude-review` check failure.** This is the Claude Code GitHub
  Action intentionally declining to run for a bot-triggered PR, not a real problem — check `test`
  instead, and merge once that's green.
- **`claude-review` can also fail from its own infra hiccups on a normal (non-Dependabot) PR** —
  seen both as a mid-run crash (`is_error:true`, no review comments posted, a permission-denial
  count in the JSON result) and as a setup failure (`bun: command not found` after a `socket hang
up` during the action's own dependency install). Neither leaves any review comment on the PR —
  check `gh api repos/<owner>/<repo>/pulls/<N>/reviews` (empty array) and the run log
  (`gh run view <id> --log-failed`) to confirm it's infra, not a real finding, before merging on
  `test: pass` alone.
- **The Claude Code GitHub App (the one triggered by `@claude` in issue/PR comments) cannot
  currently push _any_ branch in this repo.** `main` contains `.github/workflows/*` files, and
  pushing a new branch ref that contains workflow files (even byte-identical ones) requires a
  `workflows` permission scope the app installation doesn't have. Every branch here is created off
  `main`, so this blocks all `@claude`-triggered PRs, not just ones that edit workflows. Until an
  org/repo admin grants that permission, treat `@claude`-triggered issue work as producing a
  spec/diff to review and apply by hand (via a normal `gh`-authenticated session) rather than
  expecting a PR to actually land.
- GitHub Pages deploys (`deploy.yml`) share a single `concurrency: { group: pages }` — pushing
  several commits to `main` in quick succession (e.g. merging several small PRs back to back) causes
  earlier queued deploy runs to show `cancelled`; only the latest one actually goes live. Check the
  _last_ run in the sequence, not an earlier one, when verifying a deploy.

## Working in a worktree-isolated session

- Merging a PR from a worktree whose sibling worktree has `main` checked out: `gh pr merge` performs
  the merge server-side via the API, but if you also pass `--delete-branch`, the _local_
  branch-deletion step tries to switch this checkout to `main` and fails with `fatal: 'main' is
already used by worktree` — the merge itself still succeeds despite the command exiting non-zero.
  Verify with `gh pr view --json state,mergedAt` rather than trusting the exit code; delete the
  remote branch separately with `git push origin --delete <branch>` if `--delete-branch` failed.
- A squash-merged branch will always show "not fully merged" from `git branch -d` (squash merges
  don't preserve the original commits as ancestors of the merge commit) — this is expected, not a
  sign something went wrong; use `git branch -D` once the PR is confirmed merged.
- Complex multi-line bash (process substitution `<()`, `for` loops combined with git commands,
  chained `&&`/`;` sequences with redirects) is sometimes rejected by the sandbox as "too complex to
  verify stays inside worktree" even when logically safe. Prefer simple sequential commands, or use
  the `Monitor` tool for polling loops instead of a raw bash `while` loop with git/gh calls inside.
- Never run bare `git stash` — the stash stack is shared across worktrees and other sessions may be
  using it concurrently.

## Local test flakiness under full-suite parallel load

- **`pnpm test` (the full suite, 25+ files) can flake in this local sandbox under parallel
  execution — a different, unrelated test fails each run despite every generator test using fixed,
  deterministic seeds.** Confirmed environmental, not a logic bug: the same "failing" test passes
  reliably every time when run in isolation (`pnpm exec vitest run path/to/file.test.ts`), and CI
  (GitHub Actions, a more consistent environment) has shown `test: pass` on every PR all session.
  Before treating a full-suite failure as a real regression: re-run the single file that failed in
  isolation a couple of times. If it's clean alone, it's contention (worker timeouts under CPU/memory
  pressure), not a bug — don't start "fixing" generator logic chasing it. Adding more
  canvas-rendering UI tests (M2) made this more frequent; if it gets worse, consider
  `test.pool`/`test.maxWorkers` tuning in `vite.config.ts`, but that's out of scope for now since CI
  isn't affected.
- **A big spike in failure count (20+ tests across many files, `[vitest-pool-runner]: Timeout
waiting for worker to respond` in the output) usually means a stray background process is eating
  resources, not that the contention got organically worse.** Check `ps aux | grep -E "vite|chromium"`
  — a `pnpm exec vite --port <N>` left over from an earlier Playwright screenshot session (started
  with `run_in_background`, meant to be killed with `pkill -f "vite --port <N>"` after) can survive a
  failed/no-op kill and linger for hours, quietly starving later test runs. Kill it
  (`kill -9 <pid>`) and re-run — killing one stray day-old `vite` process took a run from 24 failures
  across 6 files down to the single already-known-flaky file.

## PWA offline precaching

- **`vite-plugin-pwa`'s default precache `globPattern` is `**/*.{js,css,html,ico,png,svg}` — it
  does not include `woff2`, `glb`, or any other asset type outside that list.** Vendoring the fonts
  (M2) built them into `dist/assets/` fine, but they were silently absent from the service worker's
  precache manifest (verify with `grep -o "woff2" dist/sw.js` after `pnpm build` — or more precisely,
  grep for the actual hashed filename, since a plain `"woff2"` substring won't appear if the format
  is entirely missing from the manifest). That's a real gap against the project's "installable,
  offline-first" requirement: after any HTTP-cache eviction, the app would silently fall back to
  system fonts instead of the vendored ones. Fixed by adding an explicit `workbox: { globPatterns:
[...] }` to the `VitePWA` config in `vite.config.ts` including every asset extension actually
  shipped. The animal models (`public/models/*.glb`, ~650 KB each) needed both the `glb` extension
  and `maximumFileSizeToCacheInBytes` raised above workbox's 2 MiB default. **Whenever a new binary
  asset type is added (audio, more font formats, etc.), check that extension is in this list too** — it will build successfully and work online
  without the check ever failing loudly; the gap only shows up as silently-missing offline assets.

## Before opening a PR

Run the full local check suite — see [CONTRIBUTING.md](./CONTRIBUTING.md). `pnpm format:check`
covers root-level Markdown and JSON config files too, not just source under `src/`.
