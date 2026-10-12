# Summit Clock — Design Spec

> **Superseded in part (2026-10-12, #115).** The game's presentation is now the three.js climb
> described in [`2026-10-11-3d-climb-design.md`](./2026-10-11-3d-climb-design.md) (shipped in #112).
> The "Art" decision, the [Pixel art](#pixel-art) section, the `ui/pixel` and `ui/sprites` entries
> in the file layout, the `MiniMap` HUD component, `/debug/sprites`, and milestone M2 below describe
> code that no longer exists. Game mechanics, the question engine, storage and the other milestones
> still hold. The rest of this document is kept as written.

## Context

Building a browser-based, offline-first educational game to help a 7–9 year old practice telling
time (analog + digital) and working with calendars. The repo `time-and-date-trainer` starts empty
apart from a one-paragraph README, so this is a greenfield build.

The game frames practice as mountaineering: the player is a recruit at the **High Range Climbing
Guild** earning badges by summiting ten peaks. Every question answered correctly moves their climber
up the mountain; wrong or slow answers make them slip. The intent is short (2–5 min) sessions with
enough arcade pressure to be fun, and enough per-question-type telemetry that a parent can see which
concepts need work.

Secondary goal: the project should be pleasant to maintain and extend for years as other kids use
it — hence full CI, typed pure-function content generators, and an extensible question registry.

---

## Decisions locked in

| Decision            | Choice                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Difficulty vs peaks | **Independent.** Difficulty 1–10 chosen at start, applies to all peaks. Peaks are 10 themed levels differing by theme, height, and question-type emphasis — not by difficulty. |
| Target learner      | 7–9, comfortable reading analog to 5 minutes; weak on elapsed time and date math. Difficulties 3–6 are the tuning sweet spot.                                                  |
| Stack               | TypeScript + Vite + React, Vitest + Playwright, pnpm                                                                                                                           |
| Conventions         | US 12-hour AM/PM, month-first dates, week starts Sunday. 24-hour clock introduced at difficulty 8+.                                                                            |
| Art                 | Code-defined pixel sprites (char-grid + palette arrays) rendered to canvas. No binary art assets.                                                                              |
| Layout              | Fully responsive: phone portrait, tablet/desktop landscape                                                                                                                     |
| On falling          | Retry the current peak from the bottom; already-summited peaks stay summited                                                                                                   |
| Wrong answer        | ~1.5s beat: climber slips, correct answer highlights, next question                                                                                                            |
| Audio               | Chiptune SFX synthesized via WebAudio (no audio files). Mute toggle. No background music.                                                                                      |
| Repo                | New **public** GitHub repo, Actions CI, auto-deploy to GitHub Pages, Claude Code GitHub Action                                                                                 |

---

## Game mechanics

### The climb

A peak has a height of **H steps** (20 at Peak 1 → 30 at Peak 10). The climber starts at 0; reaching
H summits the peak.

- **Correct answer** → `+1` step (`+2` while boosted)
- **Wrong answer or timeout** → `-1` step (floored at 0), climber slips animation
- Answering in **less than half** the question timer → boost meter `+2` instead of `+1`

At ~80% accuracy with boost active about half the time, net progress ≈ 1 step/question, so a peak is
~20–30 questions. At a 7s answer + 1.5s feedback cycle that lands at **2.5–4.5 minutes**. Pacing is
verified by an automated simulation test, not by guesswork (see Testing).

### Boost meter (rewards speed)

- Capacity 5. `+1` per correct answer, `+2` if answered in under half the timer.
- When full: climbing speed doubles (each correct answer is worth 2 steps). Meter stays full.
- **Any** miss resets the meter to 0 and speed to normal.

### Fall-risk meter (punishes misses)

- Capacity by difficulty: 5 at D1–3, 4 at D4–7, 3 at D8–10.
- `+1` per miss. **Only resets at the end of a peak** — not on a correct answer.
- If the meter is already full and another miss happens → **fall**: level lost, retry from the bottom.
- So the allowed misses per peak are `capacity + 1` (6 / 5 / 4).

### Difficulty profile (D = 1..10)

A single `difficultyProfile(D)` function returns everything the generators need:

- **Time precision** — weighted distribution that slides across `hour → half → quarter → five →
minute → second`. D1 is ~100% hour boundaries; D5 is mostly 5-minute; D9–10 includes seconds.
- **Timer** — 20s at D1 down to 7s at D10 (per-question-type multiplier: interactive
  drag-the-hands questions get ~1.4x, multiple choice ~1.0x).
- **Answer mode mix** — D1–3 heavily multiple choice; D4–7 mixes in interactive input; D8–10
  mostly free input / manipulation.
- **Date span** — within a month (D1–3) → across months (D4–7) → across years and leap years (D8–10).
- **24-hour clock** — enabled at D8+.

---

## Peaks

Each peak supplies a **theme** (name, palette, silhouette, flavor text, badge), a **height**, and a
**question-type emphasis** — not a difficulty. Emphasis is what keeps 10 levels from feeling
identical at a fixed difficulty.

| #   | Peak               | Emphasis                      |
| --- | ------------------ | ----------------------------- |
| 1   | Basecamp Bluff     | Reading analog clocks         |
| 2   | Sundial Spire      | Time ↔ words ("quarter past") |
| 3   | Calendar Ridge     | Reading calendars, dates      |
| 4   | The Hourglass      | Setting clock hands           |
| 5   | Weekday Wall       | Days of week, nth-weekday     |
| 6   | Elapsed Escarpment | Elapsed time arithmetic       |
| 7   | Monthfall Pass     | Date math across months       |
| 8   | The Meridian       | AM/PM and 24-hour             |
| 9   | Leap Crag          | Leap years, long spans        |
| 10  | Summit of Hours    | Everything, mixed             |

---

## Architecture

The hard, correctness-critical part (date/time math) is **pure TypeScript with zero DOM**, so it can
be exhaustively unit-tested. The UI is a thin renderer over it.

```
src/
  engine/                    pure TS — no DOM, no React
    rng.ts                   seeded mulberry32 PRNG (reproducible tests)
    timeMath.ts              precision-aware time generation + formatting
    dateMath.ts              date helpers wrapping date-fns (nth weekday, spans, weekday counts)
    difficulty.ts            D -> DifficultyProfile
    peaks.ts                 the 10 peak definitions
    climb.ts                 climb state machine (steps, boost, fallRisk, speed, fall)
    questions/
      types.ts               Question / AnswerSpec / Generator interfaces
      registry.ts            id -> generator, plus weighted selection by peak + difficulty
      readAnalog.ts, describeTime.ts, setHands.ts, elapsedAdd.ts,
      elapsedBetween.ts, digitalToAnalog.ts, hour24.ts,
      readCalendar.ts, countBetween.ts, offsetDate.ts,
      nthWeekday.ts, countWeekdays.ts, dayOfWeek.ts
  ui/
    pixel/                   PixelCanvas component, sprite grid format, palettes
    sprites/                 character grids, mountain silhouettes, icons, animation frames
    widgets/                 AnalogClock (read + draggable), DigitalClock, CalendarMonth,
                             DatePicker, ChoiceGrid, TimeEntry, NumberEntry
    hud/                     TimerBar, BoostMeter, FallRiskMeter, MiniMap, ProfileChip
    screens/                 Intro, ProfileSelect, CharacterPick, Map, Climb, Summit, Fell,
                             Settings, Stats
    debug/                   dev-only /debug/questions, /debug/sprites, /debug/widgets
  storage/                   versioned localStorage save + migrations
  audio/                     WebAudio chiptune SFX
```

### The question interface (the key extension point)

Every generator is a pure function `(rng, ctx: {difficulty, peak}) => Question`. A `Question`
declares its prompt, the widget used to _display_ it, the widget used to _answer_ it, the correct
answer, and distractors. Validation is a pure function too. Adding a question type later means
adding one file and one registry line — no UI changes.

```ts
type Question = {
  id: string;
  typeId: string;
  prompt: string; // "What time is it?"
  display: DisplaySpec; // { kind: 'analogClock', time } | { kind: 'calendar', month, highlight } | ...
  answer: AnswerSpec; // { kind: 'choice', options, correctIndex }
  // | { kind: 'setHands', target } | { kind: 'pickDate', correct }
  // | { kind: 'number', correct, unit }
  timeLimitMs: number;
  explainCorrect: string; // shown in the 1.5s reveal
};
```

### Storage

Single key `summitclock.save` holding `{ v: 1, activeProfileId, profiles: [...] }`, run through a
migration chain on load so schema changes never wipe a kid's progress.

```ts
type Profile = {
  id, name, characterId, createdAt,
  settings: { difficulty: 1..10, sound: boolean, hour24Override?: boolean },
  progress: Record<PeakId, { summited: boolean; bestTimeMs: number; attempts: number }>,
  stats: Record<QuestionTypeId, { asked: number; correct: number; totalMs: number }>,
};
```

`stats` powers a parent-facing Stats screen showing which concepts are weakest.

### Pixel art

> **Superseded (2026-10-12).** Replaced by rigged low-poly glTF animals in a three.js scene; see
> [`2026-10-11-3d-climb-design.md`](./2026-10-11-3d-climb-design.md). The pixel fonts were removed
> too (Atkinson Hyperlegible remains).

Sprites are authored in code as arrays of strings (one character per pixel) plus a named palette:

```ts
export const climberIdle = {
  w: 12, h: 16,
  grid: ['....SSSS....', '...SHHHHS...', ...],
  slots: { S: 'outline', H: 'hair', K: 'skin', J: 'jacket', P: 'pants' },
};
```

Six characters (mixed boys/girls) come from a few grid variants × palette swaps. `PixelCanvas`
renders any grid+palette to a `<canvas>` with `imageSmoothingEnabled = false` at an integer scale
derived from viewport size, so it stays crisp on every screen. Mountain scenes are drawn
procedurally per theme (silhouette + parallax bands + snowline).

Typography: two OFL pixel fonts vendored locally as subset woff2 — a chunky display face for
headings and a more readable one for question text. No network font requests (required for offline).

### Responsive layout

One CSS-grid shell with two arrangements driven by an aspect-ratio media query:

- **Portrait** — HUD strip on top, mountain band down the left third, question card fills the rest.
- **Landscape** — mountain column on the left, HUD across the top, question panel on the right.

Tap targets are sized for a 7-year-old's finger (min 44px, calendar day cells larger).

---

## Milestones

Each is independently deliverable and testable.

**M0 — Scaffold & CI.** Vite + TS + React, ESLint/Prettier, Vitest, Playwright, pnpm. GitHub Actions:
`ci.yml` (typecheck, lint, unit, e2e, build on PRs), `deploy.yml` (Pages on main), `claude.yml` +
`claude-code-review.yml` (Claude Code GitHub Action). PWA manifest + service worker via
`vite-plugin-pwa`, app icons generated from sprite code at build time.
_Verify:_ CI green on a PR; deployed URL installs to a phone home screen and loads offline.

**M1 — Engine core (headless).** `rng`, `timeMath`, `dateMath`, `difficulty`, `peaks`, `climb`, the
question interfaces and registry, plus 4 generators (read-analog MC, describe-time MC, read-calendar
MC, offset-date). Full unit tests.
_Verify:_ `pnpm test` green; `/debug/questions` lists generated questions for any difficulty.

**M2 — Pixel art foundation.** `PixelCanvas`, sprite format, 6 characters with idle/climb/slip/cheer
frames, 10 mountain themes, fonts, color tokens.
_Verify:_ `/debug/sprites` gallery renders every sprite and palette at several scales.

**M3 — Widgets.** AnalogClock (read-only and draggable hands, snapping to the question's precision),
DigitalClock, CalendarMonth with month flipping, DatePicker, ChoiceGrid, TimeEntry, NumberEntry.
_Verify:_ `/debug/widgets` playground; React Testing Library tests for drag, snap, and month nav.

**M4 — Playable vertical slice.** Intro story crawl, profile create/select, character pick, map
screen, Peak 1 fully playable with live HUD, summit/fall screens, persistence.
_Verify:_ Play Peak 1 start to finish on a phone; progress survives a reload.

**M5 — Full content.** Remaining question generators, all 10 peaks themed and wired, difficulty
tuning pass driven by the pacing simulation.
_Verify:_ Play the range at difficulty 3 and difficulty 8; simulation confirms 2–5 min per peak.

**M6 — Polish.** Chiptune SFX, transitions and animation, accessibility (reduced motion, contrast,
tap targets), Stats screen, Settings, badges, README/CONTRIBUTING/docs.
_Verify:_ Playwright smoke suite green; Lighthouse PWA + a11y pass.

---

## Testing strategy

The highest-value test is a **generator contract test**: for every question type × every difficulty
1–10 × ~200 seeds, assert the question is well-formed, its declared correct answer validates `true`,
every distractor validates `false`, and the time limit is sane. This catches the entire class of
"the game marked her right answer wrong" bugs, which is the one failure mode that would make her
stop trusting the game.

Alongside that:

- **Date math edge cases** — leap years, month-end clamping, year boundaries, DST days, nth-weekday
  when the month has 4 vs 5 of that weekday, week-start assumptions.
- **Climb state machine** — boost fill/reset, fall-risk accumulation, the fall condition, step floor.
- **Pacing simulation** — simulate a player with a given accuracy and answer speed across all peaks
  and difficulties; assert completion time falls in 2–5 minutes. Fails CI if tuning drifts.
- **Widget tests** (RTL) — hand dragging and snapping, calendar navigation, choice selection.
- **Playwright** — intro → create profile → pick peak → answer questions → HUD reacts → progress
  persists; plus a service-worker/offline check.

---

## Repo & automation setup

Files created: `.github/workflows/{ci,deploy,claude,claude-code-review}.yml`, `dependabot.yml`,
PR template, `CONTRIBUTING.md`, `LICENSE` (MIT), `.editorconfig`, tooling configs.

Two steps need the repo owner (not automatable from here):

1. `gh repo create` for the public repo, and enabling Pages (source: GitHub Actions).
2. Adding the `ANTHROPIC_API_KEY` repository secret so the Claude action can run.

The Vite `base` path is set from an env var so the Pages subpath deploy and local dev both work.
