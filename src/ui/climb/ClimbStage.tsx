import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { ClimbStatus } from '../../engine/climb';
import type { Peak } from '../../engine/peaks';
import { mountainThemeFor } from '../pixel/mountainThemes';
import { BUNNY } from '../sprites/bunny';
import type { SpriteManifest } from '../sprites/manifest';
import SpriteAnimator from '../sprites/SpriteAnimator';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';
import {
  NO_MOVE,
  moveDurationMs,
  phaseAt,
  stageFraction,
  stagePose,
  stageVars,
  wallBand,
  type ClimbStageMove,
  type StagePhase,
} from './climbStageMotion';

export { NO_MOVE, type ClimbStageMove };

/** CSS custom properties aren't part of the standard `CSSProperties` type —
 * same escape hatch `Summit.tsx` uses for its confetti. */
type StageStyle = CSSProperties & {
  '--climb-progress': string;
  '--climb-move-ms': string;
  '--climb-rock': string;
  '--climb-snow': string;
};

type HoldStyle = CSSProperties & { '--hold-fraction': string; '--hold-side': string };

/** Built once: the holds never move, only the climber does. */
function holdStyle(fraction: number, side: number): HoldStyle {
  return { '--hold-fraction': String(fraction), '--hold-side': String(side) };
}

export interface ClimbStageProps {
  peak: Peak;
  position: number;
  height: number;
  status: ClimbStatus;
  move?: ClimbStageMove;
  /** The boost meter is full, so the next correct answer moves two. Drives the
   * glow behind the climber — the one place the meter's state is visible
   * without looking away from the character. */
  boosted?: boolean;
  /** Which normalized animal is climbing. Defaults to the bunny from #93;
   * a prop so `/debug/climb-stage` and later character-select work can swap
   * it without this component knowing about the roster. */
  animal?: SpriteManifest;
  /** Meters and the bail button, floated over the top of the wall. */
  hud?: ReactNode;
  /** The question card, docked to the bottom of the stage. */
  children?: ReactNode;
}

const SPRITE_SIZE = 96;

/** How many holds to draw. One per position would be unreadable on a 30-step
 * peak at phone width, so the ladder is a fixed count and the climber lands
 * between them — the holds are the wall's texture, not a coordinate system. */
const HOLD_COUNT = 14;

const HOLDS = Array.from({ length: HOLD_COUNT }, (_, index) => ({
  key: index,
  /** Evenly spaced up the travel band, first and last inset from the ends. */
  fraction: (index + 0.5) / HOLD_COUNT,
  /** Alternating sides, so the eye reads a climbable zig-zag rather than a bar. */
  side: index % 2 === 0 ? -1 : 1,
}));

/**
 * The climb's primary progress display: a full-bleed wall the character
 * actually climbs, with the question card docked over the bottom of it.
 *
 * Two rules shape the DOM here, and both are load-bearing:
 *
 * 1. **Movement is where, animation is what.** `.climb-stage__climber` carries
 *    the translate derived from `--climb-progress` and nothing else.
 *    `.climb-stage__pose`, nested inside it, carries the squash-and-stretch
 *    keyframes. Composing pose keyframes onto the moving element reproduces the
 *    Chromium compositing smear root-caused in PR #84 — do not merge the two.
 * 2. **The wall is drawn, not photographed.** Three bands (base, middle,
 *    summit) built from repeating gradients and one SVG `<pattern>`, tinted
 *    from `mountainThemes.ts` per peak. No bitmaps, so it scales to any
 *    viewport and costs nothing to precache.
 */
export default function ClimbStage({
  peak,
  position,
  height,
  status,
  move = NO_MOVE,
  boosted = false,
  animal = BUNNY,
  hud,
  children,
}: ClimbStageProps) {
  const reducedMotion = usePrefersReducedMotion();
  // Which move has finished travelling. `null` means "none yet", so a stage
  // mounted mid-move still animates. Storing the *finished* move rather than a
  // phase flag keeps the phase derivable during render — no setState in an
  // effect body, and so no cascading render on every hop.
  const [settledSeq, setSettledSeq] = useState<number | null>(null);
  const phase: StagePhase = move.kind !== 'none' && settledSeq !== move.seq ? 'moving' : 'settled';

  // Re-armed by `move.seq`, so repeating the same kind still replays. The
  // settle is recomputed from the real clock rather than assumed, so a late
  // timer (a backgrounded tab, a busy main thread) still resolves to the right
  // phase instead of leaving the climber stuck mid-pose.
  useEffect(() => {
    if (move.kind === 'none') return;
    const startedAt = Date.now();
    const timer = setTimeout(
      () => {
        if (phaseAt(move.kind, Date.now() - startedAt, reducedMotion) === 'settled') {
          setSettledSeq(move.seq);
        }
      },
      moveDurationMs(move.kind, reducedMotion),
    );
    return () => clearTimeout(timer);
  }, [move.kind, move.seq, reducedMotion]);

  const theme = mountainThemeFor(peak.id);
  const fraction = stageFraction({ position, height, status });
  const band = wallBand(fraction);
  const pose = stagePose(move.kind, phase, status);
  const slipping = phase === 'moving' && (move.kind === 'drop' || move.kind === 'fall');
  const stageStyle: StageStyle = {
    ...stageVars(fraction, move.kind, reducedMotion),
    '--climb-rock': theme.rock,
    '--climb-snow': theme.snow,
  };

  return (
    <div
      className="climb-stage"
      data-testid="climb-stage"
      data-band={band}
      data-peak={peak.id}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      style={stageStyle}
    >
      <div className="climb-stage__wall" aria-hidden="true">
        <div className="climb-stage__band climb-stage__band--summit" />
        <div className="climb-stage__band climb-stage__band--middle" />
        <div className="climb-stage__band climb-stage__band--base" />
        <WallTexture peakId={peak.id} />
        <span className="climb-stage__cloud climb-stage__cloud--1" />
        <span className="climb-stage__cloud climb-stage__cloud--2" />
        {/* F17: something alive that isn't the player, crossing the sky. */}
        <span className="climb-stage__bird" />
      </div>

      {/* Everything the climber can reach. It is a flex child that takes
          whatever the card leaves, and every vertical position inside it is a
          percentage of *it* — so a tall question (a calendar, a clock plus
          four choices) shortens the climb rather than burying the character
          behind the card. */}
      <div className="climb-stage__field" data-testid="climb-stage-field">
        <div className="climb-stage__holds" aria-hidden="true">
          {HOLDS.map((hold) => (
            <span
              key={hold.key}
              className="climb-stage__hold"
              data-testid="climb-stage-hold"
              style={holdStyle(hold.fraction, hold.side)}
            />
          ))}
          <span className="climb-stage__summit-flag" />
        </div>

        <div
          className="climb-stage__climber"
          data-testid="climb-stage-climber"
          data-move={move.kind}
          data-phase={phase}
          data-boosted={boosted ? 'true' : 'false'}
        >
          <div className="climb-stage__perch">
            {boosted ? <span className="climb-stage__glow" aria-hidden="true" /> : null}
            <div className="climb-stage__arc">
              <div className="climb-stage__pose">
                <SpriteAnimator
                  manifest={animal}
                  pose={pose}
                  size={SPRITE_SIZE}
                  hideReducedMotionLabel
                />
              </div>
            </div>
            {slipping ? (
              <>
                <span
                  className="climb-stage__dust climb-stage__dust--1"
                  data-testid="climb-stage-dust"
                />
                <span
                  className="climb-stage__dust climb-stage__dust--2"
                  data-testid="climb-stage-dust"
                />
                <span
                  className="climb-stage__dust climb-stage__dust--3"
                  data-testid="climb-stage-dust"
                />
              </>
            ) : null}
          </div>
        </div>

        <div
          className="climb-stage__readout"
          data-testid="climb-stage-readout"
          role="progressbar"
          aria-label={`Height climbed on ${peak.name}`}
          aria-valuenow={position}
          aria-valuemin={0}
          aria-valuemax={height}
          aria-valuetext={`${position} of ${height}`}
        >
          <span className="climb-stage__readout-number">{position}</span>
          <span className="climb-stage__readout-total">/ {height}</span>
          {reducedMotion ? (
            <span className="climb-stage__pose-label" data-testid="climb-stage-pose-label">
              {pose}
            </span>
          ) : null}
        </div>

        {hud === undefined ? null : <div className="climb-stage__hud">{hud}</div>}
      </div>

      {children === undefined ? null : (
        <div className="climb-stage__card" data-testid="climb-stage-card">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The rock texture: one SVG `<pattern>` of chips and cracks, stretched over
 * the whole wall and tinted by the band colours underneath it. Purely
 * decorative, and deliberately vector — a bitmap here would need its own
 * precache entry (see the `workbox.globPatterns` note in CLAUDE.md) and would
 * blur on a tall screen.
 */
function WallTexture({ peakId }: { peakId: number }) {
  const patternId = `climb-rock-${peakId}`;
  return (
    <svg className="climb-stage__texture" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id={patternId} width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M4 10 L20 4 L34 14 L18 22 Z" fill="rgba(0,0,0,0.10)" />
          <path d="M40 34 L58 30 L62 46 L44 50 Z" fill="rgba(0,0,0,0.08)" />
          <path d="M0 44 L14 40 L22 56 L6 62 Z" fill="rgba(255,255,255,0.06)" />
          <path
            d="M30 0 C34 12 26 20 32 32 C38 44 28 52 34 64"
            stroke="rgba(0,0,0,0.14)"
            strokeWidth="1.5"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
