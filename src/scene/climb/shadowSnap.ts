import type { Vec3 } from './cliffPath';

/**
 * Where to aim the sun's shadow camera so it follows `target` without its
 * shadow edges crawling. The shadow camera keeps a fixed direction
 * (`offset` from target to light), so any movement of the target across
 * that direction slides the shadow map's texel grid over the scene and
 * re-rasterises every edge. Snapping the target's coordinates across the
 * light direction to whole texels (`texel` = frustum width / map size)
 * moves the grid only in whole-texel steps, so a static shadow stays put
 * pixel for pixel while the camera follows a hop. Pure, for testing.
 */
export function snapShadowTarget(target: Vec3, offset: Vec3, texel: number): Vec3 {
  // Orthonormal light-space basis: d along the light, r and u across it.
  const len = Math.hypot(offset.x, offset.y, offset.z) || 1;
  const d = { x: offset.x / len, y: offset.y / len, z: offset.z / len };
  // r = normalize(worldUp x d); worldUp = (0, 1, 0).
  const rLen = Math.hypot(d.z, d.x) || 1;
  const r = { x: d.z / rLen, y: 0, z: -d.x / rLen };
  // u = d x r.
  const u = {
    x: d.y * r.z - d.z * r.y,
    y: d.z * r.x - d.x * r.z,
    z: d.x * r.y - d.y * r.x,
  };
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  const snap = (value: number) => Math.round(value / texel) * texel;
  const along = dot(target, d);
  const across = snap(dot(target, r));
  const up = snap(dot(target, u));
  return {
    x: d.x * along + r.x * across + u.x * up,
    y: d.y * along + r.y * across + u.y * up,
    z: d.z * along + r.z * across + u.z * up,
  };
}
