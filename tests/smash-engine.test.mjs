import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  step,
  armSmash,
  levelConfig,
  LEVELS,
  STEP,
  hitsRequiredForLevel,
  shareText,
  scoreOf,
  HIT,
  SMASH_READY,
  SMASH,
  WORLD,
} from "../src/v1/smash-engine.ts";
const contact = (g, offset = 0) => {
  g.phase = "playing";
  g.x = g.racket + offset;
  g.y = 550;
  g.vy = 200;
  g.vx = 0;
  step(g, STEP, { target: g.racket });
};
test("Smash Up deterministic seeded runs and serve positions", () => {
  const a = createGame(42),
    b = createGame(42);
  for (let i = 0; i < 1800; i++) {
    step(a, STEP, { target: a.x });
    step(b, STEP, { target: b.x });
  }
  assert.deepEqual({ ...a, rng: null }, { ...b, rng: null });
  const serve = (seed) => {
    const g = createGame(seed);
    g.phase = "slam";
    g.delay = 0;
    step(g, STEP, { target: 180 });
    return g.x;
  };
  assert.notEqual(serve(1), serve(2));
});
test("level table, caps, cumulative hits and score", () => {
  assert.deepEqual(
    LEVELS.map((v) => [v.target, v.gravity, v.width, v.wind, v.vxMax]),
    [
      [10, 640, 96, 0, 90],
      [12, 700, 92, 0, 100],
      [15, 760, 88, 0, 110],
      [18, 820, 84, 0, 120],
      [20, 880, 80, 25, 130],
      [22, 940, 76, 45, 140],
      [25, 1000, 72, 65, 150],
      [25, 1060, 70, 85, 160],
      [28, 1120, 68, 105, 170],
      [30, 1180, 66, 125, 180],
      [30, 1240, 64, 145, 190],
      [30, 1300, 62, 165, 200],
    ],
  );
  assert.deepEqual(levelConfig(99), {
    target: 30,
    gravity: 1600,
    width: 56,
    wind: 200,
    vxMax: 200,
  });
  assert.equal(hitsRequiredForLevel(7), 97);
  assert.equal(scoreOf({ hits: 97, level: 7 }), 157);
});
test("contact angles, swept collision, miss and fixed apex at every level", () => {
  const center = createGame(1);
  contact(center);
  assert.ok(Math.abs(center.vx) <= 10);
  assert.equal(center.hits, 1);
  const edge = createGame(1);
  contact(edge, 48);
  assert.ok(edge.vx >= 80 && edge.vx <= 100);
  const fast = createGame(1);
  fast.phase = "playing";
  fast.y = 400;
  fast.vy = 3000;
  step(fast, 0.1, { target: 180 });
  assert.equal(fast.hits, 1);
  const miss = createGame(1);
  miss.phase = "playing";
  miss.x = 300;
  miss.y = 550;
  miss.vy = 600;
  for (let i = 0; i < 100; i++) step(miss, STEP, { target: 80 });
  assert.equal(miss.phase, "over");
  for (let level = 1; level <= 99; level++) {
    const g = createGame(1);
    g.level = level;
    contact(g);
    let apex = g.y;
    while (g.vy < 0) {
      step(g, STEP, { target: g.x });
      apex = Math.min(apex, g.y);
    }
    assert.ok(Math.abs(apex - WORLD.apexY) < 2, `${level}: ${apex}`);
  }
});
test("smash ready occurs once, extra hits continue, armed contact clears level", () => {
  const g = createGame(1);
  g.levelHits = 9;
  contact(g);
  assert.ok(g.events & SMASH_READY);
  contact(g);
  assert.equal(g.events, HIT);
  assert.equal(g.level, 1);
  armSmash(g);
  contact(g);
  assert.ok(g.events & SMASH);
  for (let i = 0; i < 45; i++) step(g, STEP, { target: 180 });
  assert.equal(g.level, 2);
  assert.equal(g.phase, "serve");
});
test("wind bounds and racket speed", () => {
  for (const level of [1, 4, 5, 12, 99]) {
    const g = createGame(52);
    g.level = level;
    g.phase = "playing";
    for (let i = 0; i < 3000; i++) {
      g.y = 100;
      g.vy = 0;
      const old = g.racket;
      step(g, STEP, { target: i % 2 ? 360 : 0 });
      assert.ok(Math.abs(g.racket - old) <= 2200 * STEP + 1e-10);
      assert.ok(Math.abs(g.gust) <= 1);
      if (level < 5) assert.equal(g.gust, 0);
    }
  }
});
test("share text exact and singular", () => {
  assert.equal(
    shareText(7, 97),
    "I smashed my way to level 7 with 97 hits on Smash Up 🏸 Can you beat me?",
  );
  assert.match(shareText(1, 1), /1 hit on/);
});
