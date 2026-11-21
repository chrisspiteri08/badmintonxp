// Pure presentation math. Nothing here changes the simulation or its hitbox.
export const COURT_FRACTIONS = [0, 0.057, 0.352, 0.5, 0.648, 0.943, 1] as const;
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export function courtPoint(f: number, across: number) {
  const width = 340 - 104 * f;
  return { x: 180 + (across - 0.5) * width, y: 600 - 504 * f };
}
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
  out.scale = Math.min((w - 24 * pixelRatio) / 360, h / 560);
  out.x = (w - 360 * out.scale) / 2;
  out.y = h - 600 * out.scale;
  return out;
}
export function pointerWorldX(
  x: number,
  transform: ReturnType<typeof worldTransform>,
) {
  return (x - transform.x) / transform.scale;
}

// Present the unchanged 120..560 rally as far baseline -> near service area.
// X is never independently clamped: the shared viewport padding keeps the
// existing engine bounds, visible head and pointer mapping in agreement.
export const rallyViewY = (y: number) => 96 + (y - 120) * (378 / 440);
export const shuttleDepth = (y: number) =>
  clamp(0.48 + 0.52 * ((y - 120) / 440), 0.48, 1);
