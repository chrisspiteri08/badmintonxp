import test from "node:test";
import assert from "node:assert/strict";
import {
  COURT_FRACTIONS,
  courtPoint,
  headHalfWidth,
  racketTilt,
  shuttleAngle,
  progressFraction,
  popForHits,
  worldTransform,
  pointerWorldX,
  rallyViewY,
  shuttleDepth,
} from "../src/v1/smash-visuals.ts";
import { levelConfig } from "../src/v1/smash-engine.ts";
test("badminton court geometry and service line proportions", () => {
  assert.deepEqual(COURT_FRACTIONS, [0, 0.057, 0.352, 0.5, 0.648, 0.943, 1]);
  assert.deepEqual(courtPoint(0, 0), { x: 10, y: 600 });
  assert.deepEqual(courtPoint(1, 1), { x: 298, y: 96 });
  assert.equal(courtPoint(0.5, 0.5).y, 348);
  for (const f of COURT_FRACTIONS) {
    const left = courtPoint(f, 0),
      right = courtPoint(f, 1);
    assert.ok(
      Math.abs((courtPoint(f, 0.075).x - left.x) / (right.x - left.x) - 0.075) <
        1e-12,
    );
  }
});
test("visual racket width matches physics and tilt is bounded", () => {
  for (let level = 1; level <= 20; level++)
    assert.equal(
      headHalfWidth(levelConfig(level).width),
      levelConfig(level).width / 2,
    );
  assert.equal(racketTilt(2), (14 * Math.PI) / 180);
  assert.equal(racketTilt(-2), (-14 * Math.PI) / 180);
});
test("cork leads velocity, progress clamps and pops are every five hits", () => {
  assert.equal(shuttleAngle(0, 1), 0);
  assert.equal(shuttleAngle(0, -1), -Math.PI);
  assert.equal(shuttleAngle(1, 0), -Math.PI / 2);
  assert.equal(progressFraction(-1, 10), 0);
  assert.equal(progressFraction(20, 10), 1);
  assert.equal(progressFraction(3, 10), 0.3);
  for (let n = 0; n < 100; n++)
    assert.equal(Boolean(popForHits(n)), n > 0 && n % 5 === 0);
  assert.equal(popForHits(5), "Nice!");
  assert.equal(popForHits(10), "Great!");
  assert.equal(popForHits(15), "On fire!");
});
test("bottom anchored mapping and inverse pointer mapping at different screen shapes", () => {
  for (const [w, h] of [
    [328, 565],
    [328, 820],
    [760, 600],
    [656, 1130],
  ]) {
    const t = worldTransform(w, h);
    assert.equal(600 * t.scale + t.y, h);
    assert.ok(120 * t.scale + t.y >= 0);
    for (const x of [0, 100, 180, 360])
      assert.ok(Math.abs(pointerWorldX(x * t.scale + t.x, t) - x) < 1e-10);
    const out = { scale: 0, x: 0, y: 0 };
    assert.equal(worldTransform(w, h, out), out);
  }
});

test("near racket stays centred and inside the viewport at all engine limits", () => {
  for (const dpr of [1, 2]) {
    const t = worldTransform(328 * dpr, 565 * dpr, undefined, dpr);
    assert.equal(180 * t.scale + t.x, 164 * dpr);
    for (let level = 1; level <= 99; level++) {
      const rx = levelConfig(level).width / 2;
      for (const x of [rx, 360 - rx])
        for (const angle of [-20, 0, 20]) {
          const radians = (angle * Math.PI) / 180;
          const headExtent = Math.hypot(
            rx * Math.cos(radians),
            rx * 0.42 * Math.sin(radians),
          );
          const extent = Math.max(
            headExtent,
            41 * Math.abs(Math.sin(radians)) + 4,
          );
          assert.ok((x - extent) * t.scale + t.x >= 12 * dpr - 1e-9);
          assert.ok((x + extent) * t.scale + t.x <= 316 * dpr + 1e-9);
        }
    }
    const centreY = rallyViewY(558) * t.scale + t.y;
    assert.ok(centreY - 26 * t.scale > 12 * dpr);
    assert.ok(centreY + 42 * t.scale < 553 * dpr);
  }
});
test("rallies map from the far baseline to the near court without changing physics", () => {
  assert.equal(rallyViewY(120), 96);
  assert.equal(rallyViewY(560), 474);
  assert.equal((rallyViewY(560) - 96) / 504, 0.75);
  assert.equal(shuttleDepth(120), 0.48);
  assert.equal(shuttleDepth(560), 1);
  assert.equal(shuttleDepth(-100), 0.48);
  assert.equal(shuttleDepth(900), 1);
});
