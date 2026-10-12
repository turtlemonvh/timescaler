# 3D climb: forest animals on a real mountain (issue #111)

**Status:** approved in chat 2026-10-11 (Timothy: "All lgtm aside from #7 — fine if the result is
substantially better"). Supersedes the climb-stage direction of #94 / PR #101 if accepted.

## Intent

The previous climb stage (#101) was judged "boring and uninspired": a flat CSS wall and a 96 px
sprite. The bar is **entertaining, video-game quality 3D animations of forest creatures climbing,
falling and celebrating**. Gameplay (levels, question types, climb rules, save format) stays as it
is. Everything the player _looks at_ is rebuilt.

Success is judged by a two-minute play on a local dev server against `docs/fun-bar.md`, not by a
diff.

## Decisions

| #   | Decision                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | three.js via `@react-three/fiber` + `@react-three/drei`. Animals are Quaternius "Ultimate Animated Animals" (CC0) glTF, rigged with Idle/Walk/Gallop/Jump/Death/HitReact clips. |
| 2   | Binary `.glb` under `public/models/`, 15 MB total budget, optimized by `scripts/prepare-models.ts` (glTF-Transform: strip duplicate clips, dedup, prune, resample, quantize). Workbox precache glob includes `glb`. |
| 3   | Roster: Fox, Deer, Stag, Wolf, Alpaca, Husky. Six, so the six legacy `characterId`s (`sunny`…`clover`) map 1:1 onto animals and old saves keep working. |
| 4   | Climb, Summit and Fell are one 3D scene (`ClimbScene`) in three phases. Camera follows the climber up a stylized cliff; forest at the base, clouds, peak-themed sky and rock. |
| 5   | Map is a 3D overworld (`MapScene`): ten peaks on an island, the chosen animal standing at the selected peak. The peak list / level picker / history stay DOM beside it. |
| 6   | Intro, ProfileSelect, CharacterPick, Review stay DOM, restyled. CharacterPick shows live animals on turntables (`AnimalShowcase`). |
| 7   | Question card + widgets stay DOM overlays. `AnalogClock` loses its pixel-canvas face for an SVG face. |
| 8   | Art direction: chunky low-poly, flat shading, warm key light + cool fill, soft fog. Pixel fonts removed (Press Start 2P deleted); Atkinson Hyperlegible stays. |
| 9   | WebAudio synth for hop / slip / fall / summit jingle with a persistent mute toggle. No audio binaries. |
| 10  | `src/ui/pixel`, `src/ui/sprites`, `src/ui/art`, `src/ui/character`, `MiniMap`, the sprite normalizer and `public/sprites` are deleted. |

## Architecture

```
src/
  engine/    untouched
  storage/   untouched
  scene/                       everything three.js lives here; nothing outside imports `three`
    webgl.ts                   hasWebGL() guard
    animals/roster.ts          ANIMALS[], legacy characterId → animal mapping     (pure, tested)
    animals/clips.ts           pose → glTF clip name                               (pure, tested)
    animals/Animal.tsx         useGLTF + AnimationMixer; crossfades to `pose`
    theme/peakThemes.ts        per-peak palette: rock, snow, sky, fog, trees       (pure, tested)
    climb/cliffPath.ts         position index → 3D ledge point on the cliff        (pure, tested)
    climb/motion.ts            (before, after) ClimbState → move kind + timing     (pure, tested)
    climb/ClimbScene.tsx       Canvas, lights, CliffWorld, Climber, CameraRig, Effects
    climb/CliffWorld.tsx       procedural cliff + ledges + trees + clouds + flag
    climb/Climber.tsx          drives Animal along cliffPath; hop/slip/fall/dance tweens
    climb/CameraRig.tsx        damped follow camera
    climb/Effects.tsx          dust, sparkles, confetti (instanced particles)
    map/peakLayout.ts          peak id → island position / size                    (pure, tested)
    map/MapScene.tsx           overworld
    pedestal/AnimalShowcase.tsx turntable for CharacterPick
    audio/synth.ts             WebAudio cues + mute                                (pure-ish, tested)
  ui/
    useClimbRun.ts             the question/climb state machine extracted from Climb.tsx (tested in jsdom)
    screens/*                  Climb/Summit/Fell/Map/CharacterPick rewritten; others restyled
    widgets/*                  kept; AnalogClock face → SVG
    hud/*                      BoostMeter, FallRiskMeter, TimerBar, ProfileChip kept; MiniMap deleted
```

**Data flow.** `useClimbRun` owns `ClimbState`, the current `Question`, the timer and the reveal
beat, exactly as `Climb.tsx` did. It exposes `lastMove: ClimbMove | null` (from `motion.ts`,
derived from the before/after `ClimbState` pair, so the scene can never show a hop the rules did
not grant). `ClimbScene` receives `{ peak, animalId, progress, move, phase }` and renders.

**Testing.** jsdom has no WebGL. `src/setupTests.ts` mocks the three scene entry points
(`ClimbScene`, `MapScene`, `AnimalShowcase`) with DOM stubs that expose their props as data
attributes, so every screen test asserts _what the scene was asked to do_. Every pure module under
`src/scene` has real unit tests. Visual correctness is verified by screenshots and a recording in
the PR, captured from the dev server.

**Reduced motion.** Hops, slips and falls become instant position changes; the camera snaps; the
pose is also named in text in the HUD.

## Out of scope

Question content, difficulty tuning, storage schema, server-side anything.
