import { useId } from 'react';

export interface MiniMapProps {
  position: number;
  height: number;
  /**
   * Shrink to a HUD chip. Since #94 the climb screen's primary progress
   * display is `ClimbStage` — the character on the wall — and this drops to a
   * small "how much further" glance next to the meters. It also stops
   * exposing itself as a progressbar in that mode: the stage's own readout is
   * the labelled one, and two progressbars reporting the same number is noise
   * for anyone on a screen reader.
   */
  compact?: boolean;
}

const WIDTH = 32;
const CLIMB_HEIGHT = 100;
const FLAG_HEADROOM = 12;
const SVG_HEIGHT = CLIMB_HEIGHT + FLAG_HEADROOM;
const MARKER_TOP_MARGIN = 6;
const MARKER_BOTTOM_MARGIN = 10;
const MARKER_X = 19;
/** Same drawing, ~40% smaller, so the HUD chip and the standalone widget can
 * never drift apart. */
const COMPACT_SCALE = 0.62;

const CLIFF_PATH = 'M10,100 L5,80 L16,68 L7,50 L18,32 L11,15 L21,0 L30,0 L30,100 Z';
const ROPE_PATH = 'M17,96 C25,82 12,66 20,50 C27,36 14,22 19,6';
const FLAG_PATH = `M20,0 L20,-${FLAG_HEADROOM} L32,-${FLAG_HEADROOM / 2} Z`;
const PEG_POSITIONS: readonly [number, number][] = [
  [19, 72],
  [20, 44],
  [17, 18],
];

/**
 * A vertical progress bar showing how far up the current peak the climber
 * has reached — distinct from the peak-selection `Map` screen (which shows
 * all 10 peaks); this is the small in-climb "how much further" indicator
 * the design spec's HUD section calls out separately. Painted as a cliff
 * face with a rope, milestone pegs, a summit flag, and a marker at the
 * climber's real position — the "Cliff & rope" direction approved from
 * the Climbing Direction Concepts review, replacing the earlier plain
 * filled bar.
 */
export default function MiniMap({ position, height, compact = false }: MiniMapProps) {
  const gradientId = useId();
  const fraction = height > 0 ? Math.max(0, Math.min(1, position / height)) : 0;
  const markerY =
    CLIMB_HEIGHT -
    MARKER_BOTTOM_MARGIN -
    fraction * (CLIMB_HEIGHT - MARKER_BOTTOM_MARGIN - MARKER_TOP_MARGIN);
  const drawnWidth = compact ? Math.round(WIDTH * COMPACT_SCALE) : WIDTH;
  const drawnHeight = compact ? Math.round(SVG_HEIGHT * COMPACT_SCALE) : SVG_HEIGHT;

  return (
    <div
      data-testid="mini-map"
      data-compact={compact ? 'true' : 'false'}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
    >
      <div
        {...(compact
          ? { 'aria-hidden': true }
          : {
              role: 'progressbar',
              'aria-valuenow': position,
              'aria-valuemin': 0,
              'aria-valuemax': height,
            })}
        style={{ width: drawnWidth, height: drawnHeight }}
      >
        <svg
          width={drawnWidth}
          height={drawnHeight}
          viewBox={`0 -${FLAG_HEADROOM} ${WIDTH} ${SVG_HEIGHT}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="var(--accent-shadow)" />
              <stop offset="100%" stopColor="var(--border)" />
            </linearGradient>
          </defs>
          <path d={CLIFF_PATH} fill={`url(#${gradientId})`} />
          <path
            d={ROPE_PATH}
            stroke="#e8dcc0"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            fill="none"
          />
          {PEG_POSITIONS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={2} fill="var(--gold)" />
          ))}
          <path d={FLAG_PATH} fill="var(--accent)" />
          <circle
            data-testid="mini-map-marker"
            cx={MARKER_X}
            cy={markerY}
            r={4}
            fill="var(--pine)"
            stroke="#fff"
            strokeWidth={1.5}
          />
        </svg>
      </div>
      <span data-testid="mini-map-label" style={{ fontSize: compact ? 11 : 12 }}>
        {position} / {height}
      </span>
    </div>
  );
}
