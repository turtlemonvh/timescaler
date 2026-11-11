import * as THREE from 'three';

/**
 * Hand-placed low-poly bird parts. Bird frame: forward is +X (the flight
 * direction), up is +Y, wings span ±Z. Panels are flat polygons, drawn
 * double-sided and flat-shaded.
 */

type Point = readonly [number, number, number];

/** A flat panel from a polygon, fanned from vertex 0; `flip` mirrors it to −Z. */
export function panel(points: readonly Point[], flip = false): THREE.BufferGeometry {
  const position: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    for (const [x, y, z] of [points[0], points[i], points[i + 1]]) {
      position.push(x, y, flip ? -z : z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export interface WingSpec {
  /** Shoulder joint on the +Z side; mirrored for the other wing. */
  shoulder: Point;
  /** Distance out along the span from the shoulder to the wrist. */
  wrist: number;
  /** Panel geometry for the +Z wing (index 0) and the mirrored −Z wing (index 1). */
  inner: readonly [THREE.BufferGeometry, THREE.BufferGeometry];
  outer: readonly [THREE.BufferGeometry, THREE.BufferGeometry];
}

function wing(shoulder: Point, inner: Point[], wrist: number, outer: Point[]): WingSpec {
  return {
    shoulder,
    wrist,
    inner: [panel(inner), panel(inner, true)],
    outer: [panel(outer), panel(outer, true)],
  };
}

export interface BirdShape {
  body: { radius: number; scale: Point };
  head: { radius: number; position: Point };
  /** A four-sided cone pointing forward, tipped down by `tilt`. */
  beak: { radius: number; length: number; position: Point; tilt: number };
  tail: THREE.BufferGeometry;
  wing: WingSpec;
  /** Wing and tail colour relative to the bird colour. */
  wingShade: number;
  bodyShade: number;
}

/** The flock's songbird: tapered two-part wings, a head, a beak and a notched tail. */
export const SONGBIRD: BirdShape = {
  body: { radius: 0.085, scale: [1.9, 0.95, 0.95] },
  head: { radius: 0.058, position: [0.17, 0.035, 0] },
  beak: { radius: 0.02, length: 0.06, position: [0.245, 0.03, 0], tilt: 0 },
  tail: panel([
    [-0.13, 0.01, 0],
    [-0.13, 0.01, 0.035],
    [-0.31, 0.03, 0.08],
    [-0.26, 0.03, 0],
    [-0.31, 0.03, -0.08],
    [-0.13, 0.01, -0.035],
  ]),
  wing: wing(
    [0.04, 0.035, 0.05],
    [
      [0.06, 0, 0],
      [0.05, 0, 0.19],
      [-0.07, 0, 0.19],
      [-0.1, 0, 0],
    ],
    0.19,
    [
      [0.05, 0, 0],
      [0.0, 0, 0.17],
      [-0.16, 0, 0.27],
      [-0.07, 0, 0],
    ],
  ),
  /** Wings one shade darker than the body. */
  wingShade: 0.78,
  bodyShade: 1,
};

/** The summit's soaring hawk: broad wings with fingered tips, a hooked beak and a fan tail. */
export const HAWK: BirdShape = {
  body: { radius: 0.1, scale: [2.1, 0.9, 1] },
  head: { radius: 0.06, position: [0.22, 0.03, 0] },
  beak: { radius: 0.022, length: 0.05, position: [0.28, 0.01, 0], tilt: 0.4 },
  tail: panel([
    [-0.17, 0.01, 0],
    [-0.17, 0.01, 0.05],
    [-0.36, 0.02, 0.11],
    [-0.38, 0.02, 0],
    [-0.36, 0.02, -0.11],
    [-0.17, 0.01, -0.05],
  ]),
  wing: wing(
    [0.04, 0.04, 0.06],
    [
      [0.08, 0, 0],
      [0.07, 0, 0.3],
      [-0.12, 0, 0.3],
      [-0.16, 0, 0],
    ],
    0.3,
    [
      [0.07, 0, 0],
      [0.06, 0, 0.2],
      [0.05, 0, 0.3],
      [0.01, 0, 0.24],
      [-0.01, 0, 0.32],
      [-0.04, 0, 0.24],
      [-0.07, 0, 0.3],
      [-0.09, 0, 0.2],
      [-0.12, 0, 0],
    ],
  ),
  wingShade: 0.8,
  bodyShade: 1.05,
};

export const BEAK_COLOR = '#d99a2b';
