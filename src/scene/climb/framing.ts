/**
 * Where on screen the climb camera keeps the climber, in normalized device
 * coordinates (x, y in -1..1, +y up). Pure, so the layout maths can be tested
 * without a WebGL context.
 *
 * The screens overlay HTML on the canvas: the climb's question card docks on
 * the right from 720 px wide at aspect >= 1 (`index.css`, `.climb-card`) and
 * along the bottom otherwise; the Summit/Fell result card does the same
 * (`.result-screen`). The camera frames the climber in whatever is left, so
 * a world-unit side shift can't push it off a narrow window (and a phone
 * can't lose it above the top edge).
 */
export type FramingPhase = 'climb' | 'summit' | 'fell';

export interface SafeArea {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Framing {
  /** Where the climber's body centre rests on screen. */
  homeX: number;
  homeY: number;
  /** The climber's whole body is kept inside this box. */
  safe: SafeArea;
}

/** Matches `@media (min-width: 720px) and (min-aspect-ratio: 1/1)` in `index.css`. */
export function cardDocksRight(width: number, height: number): boolean {
  return width >= 720 && width >= height;
}

/** Pixel height reserved for the HUD pill bar along the top. */
const HUD_PX = 64;
/** Keep this much NDC between the climber and any edge. */
const MARGIN = 0.05;

export function framingFor(width: number, height: number, phase: FramingPhase): Framing {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const top = phase === 'climb' ? 1 - (2 * HUD_PX) / h : 1 - MARGIN;
  if (cardDocksRight(w, h)) {
    // Climb card: right 1rem, width min(44vw, 560px). Result card: 520 px plus
    // 2rem padding. Leave a 16 px gap to the card's left edge.
    const cardLeftPx = phase === 'climb' ? w - 16 - Math.min(0.44 * w, 560) : w - 32 - 520;
    const freeRight = (2 * (cardLeftPx - 16)) / w - 1;
    const safe = {
      minX: -1 + MARGIN,
      maxX: Math.max(-1 + MARGIN + 0.2, freeRight - MARGIN),
      minY: -1 + MARGIN,
      maxY: top - MARGIN,
    };
    return {
      homeX: (safe.minX + safe.maxX) / 2,
      homeY: phase === 'fell' ? -0.15 : -0.05,
      safe,
    };
  }
  // Card along the bottom, up to ~60% of the height: keep the climber above it.
  const safe = { minX: -1 + MARGIN, maxX: 1 - MARGIN, minY: -0.1, maxY: top - MARGIN };
  return { homeX: 0, homeY: phase === 'climb' ? 0.3 : 0.4, safe };
}

/**
 * How far (in NDC) the view must pan so the box `[minX..maxX] x [minY..maxY]`
 * (the climber's projected bounds) lies inside `safe`. Positive = the box has
 * to move left/down on screen, i.e. the camera pans right/up. When the box
 * doesn't fit, its top (the head) and its left edge win.
 */
export function keepInFrame(box: SafeArea, safe: SafeArea): { dx: number; dy: number } {
  let dx = 0;
  if (box.maxX > safe.maxX) dx = box.maxX - safe.maxX;
  if (box.minX - dx < safe.minX) dx = box.minX - safe.minX;
  let dy = 0;
  if (box.minY < safe.minY) dy = box.minY - safe.minY;
  if (box.maxY - dy > safe.maxY) dy = box.maxY - safe.maxY;
  return { dx, dy };
}

/**
 * Camera distance for the climb: `base`, pulled back just enough that the
 * open part of the viewport is at least `slot` scene units wide at the
 * climber's depth (a hop plus the animal's length). Only narrow docked
 * layouts (a ~1:1 window with the card on the right) need it.
 */
export function slotDistance(
  base: number,
  safe: SafeArea,
  aspect: number,
  tanHalfFov: number,
  slot = 3.6,
): number {
  const widthPerUnit = (safe.maxX - safe.minX) * tanHalfFov * aspect;
  return widthPerUnit > 0 ? Math.max(base, slot / widthPerUnit) : base;
}
