// Pure presentation math. Nothing here changes the simulation or its hitbox.
export const PRACTICE_FLOOR_Y = 600;
export const PRACTICE_BOTTOM_Y = 628;
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export const headHalfWidth = (width: number) => width / 2;
export const racketTilt = (offset: number) =>
  (clamp(offset, -1, 1) * 14 * Math.PI) / 180;
export const shuttleAngle = (vx: number, vy: number) =>
  Math.atan2(vy, vx) - Math.PI / 2;
export const progressFraction = (hits: number, target: number) =>
  clamp(hits / Math.max(1, target), 0, 1);
export const popForHits = (hits: number) =>
  hits > 0 && hits % 5 === 0
    ? ["Nice!", "Great!", "On fire!"][(hits / 5 - 1) % 3]
    : "";
// Fit width first, bounded so the apex and all of the playable court remain visible.
// Mutate an optional output for allocation-free rendering and input conversions.
export function worldTransform(
  w: number,
  h: number,
  out = { scale: 1, x: 0, y: 0 },
  pixelRatio = 1,
) {
  out.scale = Math.min((w - 24 * pixelRatio) / 360, h / 580);
  out.x = (w - 360 * out.scale) / 2;
  out.y = h - PRACTICE_BOTTOM_Y * out.scale;
  return out;
}
export function pointerWorldX(
  x: number,
  transform: ReturnType<typeof worldTransform>,
) {
  return (x - transform.x) / transform.scale;
}

// A flat side-on scene: height never changes shuttle size or collision position.
export const sceneY = (y: number) => y;
export const floorProximity = (y: number) => clamp((y - 120) / 480, 0, 1);
