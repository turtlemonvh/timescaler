/**
 * The app icon / favicon: a low-poly mountain in the game's own look — flat
 * shaded facets, a snow cap, the summit flag, a couple of pines and a sun on a
 * sky gradient. Pure SVG so `generate-icons.ts` can rasterize every size from
 * one source and the favicon stays crisp as a vector.
 *
 * Geometry is authored on a 64×64 grid. The standard icon fills the square
 * with a rounded sky; the maskable variant bleeds the sky to the edges and
 * scales the art into the 80% safe zone so platform masks never clip it.
 */

export interface IconOptions {
  maskable?: boolean;
}

const SKY_TOP = '#4f8fd6';
const SKY_BOTTOM = '#cfe6ff';
const SUN = '#fff4c2';
const ROCK_LIGHT = '#9b8f80';
const ROCK = '#8d8275';
const ROCK_DARK = '#5e564c';
const ROCK_DEEP = '#4a443c';
const SNOW = '#f6f6f2';
const SNOW_SHADE = '#d9e2ea';
const TREE = '#4f8a4a';
const TREE_DARK = '#2f5e31';
const GROUND = '#6fa05a';
const GROUND_DARK = '#5a8a4a';
const FLAG = '#e2552f';
const POLE = '#6b4a2e';

/** The art, in 64×64 user units, origin top-left. */
function art(): string {
  return [
    // Sun, upper right.
    `<circle cx="50" cy="15" r="6.5" fill="${SUN}"/>`,
    // Ground band, drawn well past the tile so it still bleeds to the edges
    // after the maskable variant scales the scene down (the clip trims it).
    `<path d="M-40 52.5 L104 43.5 L104 120 L-40 120 Z" fill="${GROUND}"/>`,
    `<path d="M-40 57.5 L104 49 L104 120 L-40 120 Z" fill="${GROUND_DARK}"/>`,
    // Back peak (left), darker and smaller.
    `<path d="M-2 52 L16 26 L30 52 Z" fill="${ROCK_DARK}"/>`,
    `<path d="M16 26 L30 52 L22 52 Z" fill="${ROCK_DEEP}"/>`,
    `<path d="M12 32 L16 26 L20 32 L16 34 Z" fill="${SNOW_SHADE}"/>`,
    // Main peak: four facets, lit from the upper left.
    `<path d="M14 54 L36 10 L40 54 Z" fill="${ROCK}"/>`,
    `<path d="M36 10 L58 54 L40 54 Z" fill="${ROCK_DARK}"/>`,
    `<path d="M14 54 L36 10 L28 36 Z" fill="${ROCK_LIGHT}"/>`,
    `<path d="M36 10 L58 54 L48 34 Z" fill="${ROCK_DEEP}"/>`,
    // Snow cap, two facets.
    `<path d="M29.5 23 L36 10 L40 23 L36 26 L33 24 Z" fill="${SNOW}"/>`,
    `<path d="M36 10 L42.5 23 L40 23 Z" fill="${SNOW_SHADE}"/>`,
    // Flag on the summit.
    `<path d="M36 10 L36 1" stroke="${POLE}" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="M36.8 1.5 L45 4 L36.8 6.8 Z" fill="${FLAG}"/>`,
    // Pines in front, right and left.
    `<path d="M50 57 L54 47 L58 57 Z" fill="${TREE_DARK}"/>`,
    `<path d="M51 53 L54 45 L57 53 Z" fill="${TREE}"/>`,
    `<rect x="53.2" y="57" width="1.6" height="3" fill="${POLE}"/>`,
    `<path d="M5 59 L9 48 L13 59 Z" fill="${TREE_DARK}"/>`,
    `<path d="M6 55 L9 46 L12 55 Z" fill="${TREE}"/>`,
    `<rect x="8.2" y="59" width="1.6" height="3" fill="${POLE}"/>`,
  ].join('');
}

export function buildIconSvg(size: number, options: IconOptions = {}): string {
  const maskable = options.maskable ?? false;
  // Standard icons get a rounded sky tile; maskable ones bleed to the edge
  // and shrink the art into the centre 80% (the platform's safe zone).
  const radius = maskable ? 0 : 12;
  const transform = maskable ? 'translate(6.4 6.4) scale(0.8)' : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">`,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${SKY_TOP}"/><stop offset="1" stop-color="${SKY_BOTTOM}"/>`,
    `</linearGradient>`,
    `<clipPath id="tile"><rect width="64" height="64" rx="${radius}"/></clipPath></defs>`,
    `<g clip-path="url(#tile)">`,
    `<rect width="64" height="64" fill="url(#sky)"/>`,
    transform ? `<g transform="${transform}">${art()}</g>` : art(),
    `</g></svg>`,
  ].join('');
}
