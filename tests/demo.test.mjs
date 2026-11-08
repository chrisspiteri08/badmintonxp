import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  act,
  reconcile,
  totals,
  addAward,
  guestXP,
  earnedXP,
  QUESTIONS,
  EVENT,
  PAST_EVENT,
  SEASON,
} from "../src/demo/model.ts";
const start = () => act(freshState(1000), { type: "start" }, 1000);
function answer(s, index, option, time = 1100) {
  return act(s, { type: "answer", index, option }, time);
}
function play(options) {
  let s = start();
  options.forEach((option, index) => {
    s = answer(s, index, option, 1100 + index * 100);
    s = act(s, { type: "next" }, 1100 + index * 100);
  });
  return s;
}
test("ledger awards are idempotent; actual final answer is included synchronously", () => {
  const s = play(QUESTIONS.map((q) => q.correct));
  assert.equal(s.attempt.complete, true);
  assert.equal(earnedXP(s), 30);
  assert.equal(guestXP(s), 170);
  const award = s.ledger.at(-1);
  assert.deepEqual(addAward(s, award), s);
  assert.deepEqual(act(s, { type: "start" }, 5000), reconcile(s, 5000));
  assert.equal(earnedXP(answer(s, 2, 2, 5000)), 30);
});
test("wrong answers zero; final answer only adds its actual value", () => {
  assert.equal(earnedXP(play([0, 0, 2])), 10);
  assert.equal(earnedXP(play([0, 0, 0])), 0);
});
test("double tap and stale question handlers ignored", () => {
  let s = answer(start(), 0, 2);
  s = answer(s, 0, 0);
  assert.equal(s.attempt.answers.length, 1);
  assert.equal(s.attempt.answers[0].xp, 10);
  s = act(s, { type: "next" }, 1200);
  s = answer(s, 0, 2, 1300);
  assert.equal(s.attempt.answers.length, 1);
});
test("deadline exact boundary rejects answer; timeout zero and advances", () => {
  const s = answer(start(), 0, 2, 16000);
  assert.equal(s.attempt.answers[0].option, null);
  assert.equal(s.attempt.answers[0].xp, 0);
  assert.equal(s.attempt.deadline, 31000);
  assert.equal(s.attempt.answers.length, 1);
});
test("navigation/reload/remount preserves absolute deadline; away questions catch up", () => {
  let s = JSON.parse(JSON.stringify(start()));
  s = act(s, { type: "start" }, 6000);
  assert.equal(s.attempt.deadline, 16000);
  s = reconcile(s, 32000);
  assert.equal(s.attempt.answers.length, 2);
  assert.equal(s.attempt.deadline, 46000);
  s = reconcile(JSON.parse(JSON.stringify(s)), 50000);
  assert.equal(s.attempt.complete, true);
  assert.equal(earnedXP(s), 0);
  assert.equal(s.ledger.filter((a) => a.challenge === "shuttle-iq").length, 1);
});
test("locked answers persist; next starts once and does not restart on repeated next", () => {
  let s = answer(start(), 0, 2);
  s = reconcile(JSON.parse(JSON.stringify(s)), 50000);
  assert.equal(s.attempt.answers.length, 1);
  s = act(s, { type: "next" }, 50000);
  assert.equal(s.attempt.deadline, 65000);
  s = act(s, { type: "next" }, 60000);
  assert.equal(s.attempt.deadline, 65000);
});
test("predictions: no entry XP, duplicate/late guards, close before settle, once only", () => {
  let s = freshState(1000);
  s = act(s, { type: "settle" }, 1001);
  assert.equal(s.settled, false);
  s = act(s, { type: "predict", option: "Ember" }, 2000);
  assert.equal(earnedXP(s), 0);
  s = act(s, { type: "predict", option: "Kite" }, 3000);
  assert.equal(s.entry.option, "Ember");
  s = act(s, { type: "close" }, 3000);
  s = act(s, { type: "settle" }, 3000);
  assert.equal(earnedXP(s), 20);
  assert.equal(s.settled, true);
  s = act(JSON.parse(JSON.stringify(s)), { type: "settle" }, 4000);
  assert.equal(earnedXP(s), 20);
  const late = act(
    freshState(1000),
    { type: "predict", option: "Ember" },
    301000,
  );
  assert.equal(late.entry, null);
});
test("wrong prediction and no entry settle with zero, without participation awards", () => {
  for (const pick of [null, "Kite"]) {
    let s = freshState(1000);
    if (pick) s = act(s, { type: "predict", option: pick }, 1001);
    s = act(s, { type: "settle" }, 301000);
    assert.equal(earnedXP(s), 0);
    assert.equal(s.settled, true);
  }
});
test("one ledger drives event/season/person/team/country sums and award attribution", () => {
  const s = play([2, 1, 2]);
  for (const scope of ["event", "season"]) {
    const sum = s.ledger
      .filter(
        (a) => a.season === SEASON && (scope === "season" || a.event === EVENT),
      )
      .reduce((n, a) => n + a.xp, 0);
    for (const league of ["players", "teams", "countries"])
      assert.equal(
        totals(s, scope, league).reduce((n, r) => n + r.xp, 0),
        sum,
      );
  }
  assert.equal(totals(s, "event", "players").find((r) => r.you).xp, 70);
  assert.equal(totals(s, "season", "players").find((r) => r.you).xp, 170);
  const a = s.ledger.at(-1);
  assert.equal(a.team, "Neon Shuttles");
  assert.equal(a.country, "Malaysia");
  assert.equal(a.event, EVENT);
  assert.equal(a.season, SEASON);
  assert.ok(s.ledger.some((a) => a.event === PAST_EVENT));
});
test("ties share rank and stable ID display; full reset restores only fictional fixtures", () => {
  const s = play([2, 0, 0]);
  s.ledger.push({ ...s.ledger.at(-1), id: "tie-fixture", xp: 5 });
  const rows = totals(s, "event", "players");
  assert.equal(
    rows.find((r) => r.id === "guest").rank,
    rows.find((r) => r.id === "fox").rank,
  );
  assert.deepEqual(
    rows.filter((r) => r.xp === 55).map((r) => r.id),
    ["fox", "guest"],
  );
  const reset = freshState(5000);
  assert.equal(earnedXP(reset), 0);
  assert.equal(reset.attempt, null);
  assert.equal(reset.entry, null);
});
test("clock rollback cannot reopen entries or reset question timer", () => {
  let s = reconcile(start(), 12000);
  s = reconcile(s, 2000);
  assert.equal(s.lastNow, 12000);
  assert.equal(s.attempt.deadline, 16000);
  s = act(s, { type: "close" }, 12000);
  assert.equal(act(s, { type: "predict", option: "Ember" }, 1).entry, null);
});
