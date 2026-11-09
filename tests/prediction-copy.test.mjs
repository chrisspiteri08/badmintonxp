import { test } from "node:test";
import assert from "node:assert/strict";
import { closesIn, predictionResult } from "../src/demo/prediction-copy.ts";

test("prediction countdown handles hours, minutes, seconds and the exact close boundary", () => {
  assert.equal(closesIn(8_040_000, 0), "Closes in 2h 14m");
  assert.equal(closesIn(300_000, 0), "Closes in 5m 0s");
  assert.equal(closesIn(59_001, 0), "Closes in 1m 0s");
  assert.equal(closesIn(1, 0), "Closes in 1s");
  assert.equal(closesIn(100, 100), "Entries closed");
  assert.equal(closesIn(100, 101), "Entries closed");
});
test("result copy reflects the fixed winner without claiming a winning losing pick", () => {
  assert.equal(predictionResult("Ember", 20), "Ember wins! You called it. +20 XP");
  assert.equal(predictionResult("Kite", 20), "Ember wins. Better luck next time.");
  assert.equal(predictionResult(null, 20), "Ember wins. No entry · 0 XP");
});
