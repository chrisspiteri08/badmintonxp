import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, local, password, sql } from "../v1-browser/local.ts";
let f, alice, bob, aliceId, bobId;
const rpc = async (c, name, args) => {
  const r = await c.rpc(name, args);
  assert.equal(r.error, null, r.error?.message);
  return r.data;
};
before(async () => {
  f = await fixture(randomUUID().slice(0, 8));
  const ctx = local();
  for (const name of ["alice", "bob"]) {
    const email = `${name}-${randomUUID()}@example.test`,
      pass = password();
    const r = await ctx.admin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { role: "admin", is_admin: true },
    });
    assert.equal(r.error, null);
    const c = ctx.player();
    assert.equal(
      (await c.auth.signInWithPassword({ email, password: pass })).error,
      null,
    );
    if (name === "alice") {
      alice = c;
      aliceId = r.data.user.id;
    } else {
      bob = c;
      bobId = r.data.user.id;
    }
  }
});
test("local Supabase: RLS hides other profiles, attempts, answers, predictions and ledger", async () => {
  assert.deepEqual(
    (await alice.from("profiles").select("id").eq("id", bobId)).data,
    [],
  );
  assert.equal((await alice.from("profiles").select("id")).data.length, 1);
  await rpc(alice, "v1_quiz", { p_quiz_id: f.quiz, p_action: "start" });
  await rpc(alice, "v1_predict", { p_match_id: f.match, p_pick: "Ember" });
  for (const table of [
    "attempts",
    "attempt_answers",
    "predictions",
    "xp_ledger",
  ])
    assert.deepEqual((await bob.from(table).select("*")).data, []);
  const home = await rpc(alice, "v1_home");
  assert.equal(
    home.admin,
    false,
    "user-editable signup metadata cannot grant admin",
  );
  assert.equal(
    (await alice.rpc("v1_admin_snapshot")).error?.message,
    "Admin access required.",
  );
});
test("local Supabase: player cannot write profiles, awards, attempts, answers, results or roles directly", async () => {
  for (const table of [
    "profiles",
    "attempts",
    "attempt_answers",
    "predictions",
    "xp_ledger",
    "matches",
    "questions",
    "tournaments",
  ]) {
    const insert = await alice.from(table).insert({});
    assert.ok(insert.error, `${table} insert denied`);
    const del = await alice.from(table).delete().not("id", "is", null);
    assert.ok(del.error, `${table} delete denied`);
  }
  assert.ok(
    (
      await alice
        .from("profiles")
        .update({ username: "hacked" })
        .eq("id", bobId)
    ).error,
  );
  assert.ok(
    (await alice.from("xp_ledger").update({ xp: 999 }).eq("user_id", aliceId))
      .error,
  );
  assert.ok(
    (await alice.schema("private").from("admins").insert({ user_id: aliceId }))
      .error,
  );
  assert.ok(
    (await alice.schema("private").from("question_answers").select("*")).error,
  );
  assert.deepEqual((await alice.from("questions").select("*")).data, []);
});
test("local Supabase: concurrent starts/answers cannot replay or double award; no early answer keys", async () => {
  const starts = await Promise.all(
    [1, 2, 3].map(() =>
      rpc(alice, "v1_quiz", { p_quiz_id: f.quiz, p_action: "start" }),
    ),
  );
  assert.equal(new Set(starts.map((s) => s.id)).size, 1);
  assert.equal(starts[0].answers.length, 0);
  assert.equal(starts[0].question.correct_option, undefined);
  await Promise.all(
    [2, 0, 2].map((p_option) =>
      rpc(alice, "v1_quiz", {
        p_quiz_id: f.quiz,
        p_action: "answer",
        p_position: 0,
        p_option,
      }),
    ),
  );
  let state = await rpc(alice, "v1_quiz", {
    p_quiz_id: f.quiz,
    p_action: "resume",
  });
  assert.equal(state.answers.length, 1);
  for (const position of [1, 2]) {
    await rpc(alice, "v1_quiz", { p_quiz_id: f.quiz, p_action: "next" });
    state = await rpc(alice, "v1_quiz", {
      p_quiz_id: f.quiz,
      p_action: "answer",
      p_position: position,
      p_option: 2,
    });
  }
  assert.equal(state.complete, true);
  assert.ok([20, 30].includes(state.score));
  await rpc(alice, "v1_quiz", { p_quiz_id: f.quiz, p_action: "start" });
  const ledger = await alice.from("xp_ledger").select("*");
  assert.equal(ledger.data.length, 1);
  assert.equal(ledger.data[0].xp, state.score);
  assert.equal(
    (
      await alice.rpc("v1_quiz", {
        p_quiz_id: f.quiz,
        p_action: "answer",
        p_position: 0,
        p_option: 2,
        p_xp: 500,
      })
    ).error !== null,
    true,
  );
});
test("local Supabase: server-clock expiry rejects late answers and completes once", async () => {
  const a = await rpc(bob, "v1_quiz", { p_quiz_id: f.quiz, p_action: "start" });
  sql(
    `update public.attempts set deadline=clock_timestamp()-interval '46 seconds' where id='${a.id}';`,
  );
  const expired = await rpc(bob, "v1_quiz", {
    p_quiz_id: f.quiz,
    p_action: "answer",
    p_position: 0,
    p_option: 2,
  });
  assert.equal(expired.score, 0);
  assert.equal(expired.complete, true);
  assert.ok(expired.answers.every((a) => a.option === null));
  assert.equal(
    (await rpc(bob, "v1_quiz", { p_quiz_id: f.quiz, p_action: "start" }))
      .complete,
    true,
  );
});
test("local Supabase: lock, late entry, admin result immutability and ledger uniqueness", async () => {
  await Promise.all(
    [1, 2].map(() =>
      rpc(alice, "v1_predict", { p_match_id: f.match, p_pick: "Kite" }),
    ),
  );
  assert.equal(
    (await alice.from("predictions").select("*")).data[0].pick,
    "Ember",
  );
  assert.ok(
    (
      await alice.rpc("v1_settle_match", {
        p_match_id: f.match,
        p_winner: "Ember",
      })
    ).error,
  );
  sql(
    `update public.matches set closes_at=clock_timestamp()-interval '1 second' where id='${f.match}';`,
  );
  assert.ok(
    (await bob.rpc("v1_predict", { p_match_id: f.match, p_pick: "Ember" }))
      .error,
  );
  await Promise.all(
    [1, 2, 3].map(() =>
      rpc(f.owner, "v1_settle_match", {
        p_match_id: f.match,
        p_winner: "Ember",
      }),
    ),
  );
  assert.ok(
    (
      await f.owner.rpc("v1_settle_match", {
        p_match_id: f.match,
        p_winner: "Kite",
      })
    ).error,
  );
  const ledger = await alice
    .from("xp_ledger")
    .select("*")
    .eq("source_type", "prediction");
  assert.equal(ledger.data.length, 1);
  assert.equal(ledger.data[0].xp, 20);
});
test("local Supabase: anonymous rankings expose aggregate scores, not private player data", async () => {
  const anon = local().player();
  const home = await rpc(anon, "v1_home");
  assert.equal(home.profile, null);
  assert.equal(home.admin, false);
  const board = await rpc(anon, "v1_leaderboard", {
    p_tournament_id: f.tournament,
    p_scope: "event",
    p_league: "players",
  });
  assert.ok(board.some((r) => r.id === aliceId));
  assert.ok(
    board.every((r) => Object.keys(r).sort().join(",") === "id,name,rank,xp"),
  );
  assert.ok((await anon.from("profiles").select("*")).error);
  assert.ok(
    (await anon.rpc("v1_quiz", { p_quiz_id: f.quiz, p_action: "start" })).error,
  );
});

test("local Supabase: World Tour Finals 2026 publication is blocked and invisible to anonymous players", async () => {
  const save = async (kind, data) =>
    rpc(f.owner, "v1_admin_save", { p_kind: kind, p_data: data });
  const seasons = await f.owner.rpc("v1_admin_snapshot");
  const season = seasons.data.seasons[0].id;
  const held = await save("tournament", {
    name: "World Tour Finals 2026",
    season_id: season,
    starts_at: "2026-01-01",
    ends_at: "2099-01-01",
  });
  await save("match", {
    tournament_id: held,
    athlete_a: "Hold player A",
    athlete_b: "Hold player B",
    closes_at: "2099-01-01",
  });
  const quiz = await save("quiz", {
    tournament_id: held,
    title: "Held quiz",
    opens_at: "2026-01-01",
    closes_at: "2099-01-01",
  });
  await save("question", {
    quiz_id: quiz,
    position: 0,
    prompt: "Is this local only?",
    options: ["Yes", "No", "Maybe", "Later"],
    correct_option: 0,
    explanation: "Local test fixture.",
  });
  await save("publish_quiz", { id: quiz });
  const result = await f.owner.rpc("v1_admin_save", {
    p_kind: "publish_tournament",
    p_data: { id: held },
  });
  assert.match(result.error?.message || "", /publication is on hold/);
  const row = await f.owner
    .from("tournaments")
    .select("published,active")
    .eq("id", held)
    .single();
  assert.equal(row.data.published, false);
  assert.equal(row.data.active, false);
  assert.deepEqual(
    (await local().player().from("tournaments").select("*").eq("id", held))
      .data,
    [],
  );
});
