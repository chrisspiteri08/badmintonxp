import test from "node:test";
import assert from "node:assert/strict";
import {
  headHalfWidth,
  racketTilt,
  shuttleAngle,
  progressFraction,
  popForHits,
  worldTransform,
  pointerWorldX,
  sceneY,
  floorProximity,
  PRACTICE_FLOOR_Y,
  PRACTICE_BOTTOM_Y,
} from "../src/v1/smash-visuals.ts";
import { levelConfig } from "../src/v1/smash-engine.ts";
test("solo floor remains the engine's existing fail line", () => {
  assert.equal(PRACTICE_FLOOR_Y, 600);
  assert.equal(PRACTICE_BOTTOM_Y, 628);
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
    assert.equal(PRACTICE_BOTTOM_Y * t.scale + t.y, h);
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
    const centreY = sceneY(558) * t.scale + t.y;
    assert.ok(centreY - 26 * t.scale > 12 * dpr);
    assert.ok(centreY + 42 * t.scale < 553 * dpr);
  }
});
test("solo scene has no perspective scaling and the floor shadow grows with proximity", () => {
  for (const y of [120, 280, 560, 600]) assert.equal(sceneY(y), y);
  assert.equal(floorProximity(120), 0);
  assert.equal(floorProximity(600), 1);
  assert.ok(floorProximity(560) > floorProximity(280));
});
