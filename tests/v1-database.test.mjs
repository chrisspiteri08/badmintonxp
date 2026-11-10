import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const alice = "10000000-0000-0000-0000-000000000001",
  bob = "20000000-0000-0000-0000-000000000002",
  admin = "30000000-0000-0000-0000-000000000003";
let team, season, tournament, quiz, match;
const scalar = async (sql, params = []) =>
  (await db.query(sql, params)).rows[0];
const rpc = async (name, params = []) =>
  (
    await db.query(
      `select public.${name}(${params.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
      params,
    )
  ).rows[0].value;
async function asUser(id, fn, role = "authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrationDir))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(new URL(file, migrationDir), "utf8"));
  }
  await db.query(
    "insert into auth.users(id,email) values($1,$2),($3,$4),($5,$6)",
    [
      alice,
      "alice@example.test",
      bob,
      "bob@example.test",
      admin,
      "admin@example.test",
    ],
  );
  await db.query("insert into private.admins(user_id) values($1)", [admin]);
  await asUser(admin, async () => {
    team = await rpc("v1_admin_save", ["team", { name: "Neon Shuttles" }]);
    season = await rpc("v1_admin_save", [
      "season",
      { name: "Isolated test season" },
    ]);
    tournament = await rpc("v1_admin_save", [
      "tournament",
      {
        name: "Isolated test cup",
        season_id: season,
        starts_at: "2026-01-01T00:00:00Z",
        ends_at: "2099-01-01T00:00:00Z",
      },
    ]);
    match = await rpc("v1_admin_save", [
      "match",
      {
        tournament_id: tournament,
        athlete_a: "Ember",
        athlete_b: "Kite",
        closes_at: "2099-01-01T00:00:00Z",
      },
    ]);
    quiz = await rpc("v1_admin_save", [
      "quiz",
      {
        tournament_id: tournament,
        title: "Server-scored quiz",
        opens_at: "2026-01-01T00:00:00Z",
        closes_at: "2099-01-01T00:00:00Z",
      },
    ]);
    for (let i = 0; i < 3; i++)
      await rpc("v1_admin_save", [
        "question",
        {
          quiz_id: quiz,
          position: i,
          prompt: `Test question ${i + 1}?`,
          options: ["One", "Two", "Three", "Four"],
          correct_option: 2,
          explanation: "Three is correct.",
        },
      ]);
    await rpc("v1_admin_save", ["publish_quiz", { id: quiz }]);
    await rpc("v1_admin_save", ["publish_tournament", { id: tournament }]);
  });
});
after(() => db.close());
test("v1: every app table has RLS and clients cannot read answer keys", async () => {
  const tables = (
    await db.query(
      "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and relkind='r'",
    )
  ).rows;
  assert.equal(tables.length, 14);
  assert.ok(tables.every((t) => t.relrowsecurity));
  await asUser(alice, async () => {
    await assert.rejects(
      db.query("select * from private.question_answers"),
      /permission denied/,
    );
    assert.deepEqual(
      (await db.query("select * from public.questions")).rows,
      [],
    );
    await assert.rejects(
      db.query("select private.finish_quiz($1)", [quiz]),
      /permission denied/,
    );
  });
});
test("v1: profile isolation, XP immutability, role escalation and admin authorization", async () => {
  await asUser(alice, async () => {
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.profiles where id=$1", [bob])).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query("update public.profiles set username='hacked' where id=$1", [
        bob,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.xp_ledger set xp=500"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("insert into public.xp_ledger default values"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("delete from public.xp_ledger"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("insert into private.admins values($1)", [alice]),
      /permission denied/,
    );
    await assert.rejects(rpc("v1_admin_snapshot"), /Tournament desk access/);
    await assert.rejects(
      rpc("v1_settle_match", [match, "Ember"]),
      /Tournament desk access/,
    );
    await rpc("v1_profile", ["Alice", "MY", team]);
  });
});
test("v1: server deadline, no early answers, first-tap and stale requests; final XP once", async () => {
  await asUser(alice, async () => {
    let a = await rpc("v1_quiz", [quiz, "start"]);
    assert.equal(new Date(a.deadline) - new Date(a.server_now) <= 15000, true);
    assert.equal(a.question.position, 0);
    assert.equal(a.answers.length, 0);
    assert.ok(!JSON.stringify(a.question).includes("correct_option"));
    const deadline = a.deadline;
    assert.equal((await rpc("v1_quiz", [quiz, "start"])).deadline, deadline);
    a = await rpc("v1_quiz", [quiz, "answer", 0, 2]);
    assert.equal(a.score, 10);
    assert.equal(a.question, null);
    assert.equal(a.answers[0].correct_option, 2);
    a = await rpc("v1_quiz", [quiz, "answer", 0, 0]);
    assert.equal(a.answers.length, 1);
    assert.equal(a.score, 10);
    await assert.rejects(rpc("v1_profile", ["Alice", "ID", null]), /locked/);
    await rpc("v1_quiz", [quiz, "next"]);
    a = await rpc("v1_quiz", [quiz, "answer", 0, 2]);
    assert.equal(a.answers.length, 1);
    a = await rpc("v1_quiz", [quiz, "answer", 1, 0]);
    assert.equal(a.score, 10);
    await rpc("v1_quiz", [quiz, "next"]);
    a = await rpc("v1_quiz", [quiz, "answer", 2, 2]);
    assert.equal(a.complete, true);
    assert.equal(a.score, 20);
    await rpc("v1_quiz", [quiz, "answer", 2, 2]);
    await rpc("v1_quiz", [quiz, "start"]);
    const rows = (await db.query("select * from public.xp_ledger")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].xp, 20);
  });
  await asUser(bob, async () => {
    assert.equal(
      (await db.query("select * from public.attempts")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.attempt_answers")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.xp_ledger")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("update public.attempts set complete=true"),
      /permission denied/,
    );
  });
});
test("v1: expired offline questions catch up; late answer earns zero and cannot restart", async () => {
  const a = await asUser(bob, () => rpc("v1_quiz", [quiz, "start"]));
  await db.query(
    "update public.attempts set deadline=clock_timestamp()-interval '46 seconds' where id=$1",
    [a.id],
  );
  await asUser(bob, async () => {
    const late = await rpc("v1_quiz", [quiz, "answer", 0, 2]);
    assert.equal(late.complete, true);
    assert.equal(late.score, 0);
    assert.equal(late.answers.length, 3);
    assert.ok(late.answers.every((a) => a.option === null));
    assert.equal((await rpc("v1_quiz", [quiz, "start"])).complete, true);
  });
});
test("v1: predictions lock once, deadline is server-side, result and awards are idempotent", async () => {
  await asUser(alice, async () => {
    const p = await rpc("v1_predict", [match, "Ember"]);
    assert.equal((await rpc("v1_predict", [match, "Kite"])).id, p.id);
    assert.equal((await rpc("v1_predict", [match, "Kite"])).pick, "Ember");
  });
  await asUser(bob, async () => {
    assert.equal(
      (await db.query("select * from public.predictions")).rows.length,
      0,
    );
    await rpc("v1_predict", [match, "Kite"]);
    await assert.rejects(
      db.query("update public.predictions set pick='Ember'"),
      /permission denied/,
    );
  });
  await asUser(admin, () =>
    assert.rejects(rpc("v1_settle_match", [match, "Ember"]), /Wait until/),
  );
  await db.query(
    "update public.matches set closes_at=clock_timestamp()-interval '1 second' where id=$1",
    [match],
  );
  await asUser(admin, async () => {
    await assert.rejects(rpc("v1_predict", [match, "Ember"]), /closed/);
    await rpc("v1_settle_match", [match, "Ember"]);
    await rpc("v1_settle_match", [match, "Ember"]);
    await assert.rejects(
      rpc("v1_settle_match", [match, "Kite"]),
      /already final/,
    );
  });
  const rows = (
    await db.query(
      "select * from public.xp_ledger where source_type='prediction' order by user_id",
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.xp),
    [20, 0],
  );
  assert.equal(rows[0].team_id, team);
});
test("v1: public leaderboards aggregate immutable ledger across people, teams, countries and season", async () => {
  await asUser(
    null,
    async () => {
      for (const scope of ["event", "season"]) {
        const people = (
          await db.query("select * from public.v1_leaderboard($1,$2,$3)", [
            tournament,
            scope,
            "players",
          ])
        ).rows;
        assert.equal(people[0].name, "Alice");
        assert.equal(Number(people[0].xp), 40);
        assert.equal(Number(people[0].rank), 1);
        for (const group of ["teams", "countries"]) {
          const rows = (
            await db.query("select * from public.v1_leaderboard($1,$2,$3)", [
              tournament,
              scope,
              group,
            ])
          ).rows;
          assert.equal(
            rows.reduce((n, r) => n + Number(r.xp), 0),
            40,
          );
        }
      }
      const home = await rpc("v1_home");
      assert.equal(home.profile, null);
      assert.equal(home.admin, false);
      assert.ok(!JSON.stringify(home).includes("correct_option"));
      await assert.rejects(
        rpc("v1_quiz", [quiz, "start"]),
        /permission denied/,
      );
    },
    "anon",
  );
});
test("v1: published content cannot change and draft events are invisible to players", async () => {
  await asUser(admin, async () => {
    await assert.rejects(
      rpc("v1_admin_save", [
        "question",
        {
          quiz_id: quiz,
          position: 3,
          prompt: "Can this change?",
          options: ["A", "B", "C", "D"],
          correct_option: 0,
          explanation: "No",
        },
      ]),
      /cannot be changed/,
    );
    const draft = await rpc("v1_admin_save", [
      "tournament",
      {
        name: "Unpublished test",
        season_id: season,
        starts_at: "2026-01-01",
        ends_at: "2099-01-01",
      },
    ]);
    await asUser(alice, async () =>
      assert.equal(
        (
          await db.query("select * from public.tournaments where id=$1", [
            draft,
          ])
        ).rows.length,
        0,
      ),
    );
  });
});

test("v1: World Tour Finals 2026 remains private and cannot be published even by admin RPC", async () => {
  let held;
  await asUser(admin, async () => {
    held = await rpc("v1_admin_save", [
      "tournament",
      {
        name: "World Tour Finals 2026",
        season_id: season,
        starts_at: "2026-01-01",
        ends_at: "2099-01-01",
      },
    ]);
    await rpc("v1_admin_save", [
      "match",
      {
        tournament_id: held,
        athlete_a: "Hold player A",
        athlete_b: "Hold player B",
        closes_at: "2099-01-01",
      },
    ]);
    const q = await rpc("v1_admin_save", [
      "quiz",
      {
        tournament_id: held,
        title: "Hold test quiz",
        opens_at: "2026-01-01",
        closes_at: "2099-01-01",
      },
    ]);
    await rpc("v1_admin_save", [
      "question",
      {
        quiz_id: q,
        position: 0,
        prompt: "Is this only a test?",
        options: ["Yes", "No", "Maybe", "Later"],
        correct_option: 0,
        explanation: "Local test only.",
      },
    ]);
    await rpc("v1_admin_save", ["publish_quiz", { id: q }]);
    await assert.rejects(
      rpc("v1_admin_save", ["publish_tournament", { id: held }]),
      /publication is on hold/,
    );
  });
  const row = await scalar(
    "select published,active from public.tournaments where id=$1",
    [held],
  );
  assert.equal(row.published, false);
  assert.equal(row.active, false);
  await asUser(
    null,
    async () => {
      assert.equal(
        (await db.query("select * from public.tournaments where id=$1", [held]))
          .rows.length,
        0,
      );
      assert.deepEqual(
        (await db.query("select * from public.v1_leaderboard($1)", [held]))
          .rows,
        [],
      );
    },
    "anon",
  );
});

test("v1: content editors manage content/results without player, role or manual-XP privileges", async () => {
  const editor = "40000000-0000-0000-0000-000000000004";
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    editor,
    "editor@example.test",
  ]);
  await db.query("insert into private.content_editors(user_id) values($1)", [
    editor,
  ]);
  await asUser(editor, async () => {
    const home = await rpc("v1_home");
    assert.equal(home.admin, false);
    assert.equal(home.content_editor, true);
    const snapshot = await rpc("v1_admin_snapshot");
    assert.equal(snapshot.role, "content_editor");
    assert.deepEqual(snapshot.players, []);
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.xp_ledger")).rows.length,
      0,
    );
    for (const sql of [
      "insert into private.admins(user_id) values($1)",
      "insert into private.content_editors(user_id) values($1)",
    ])
      await assert.rejects(db.query(sql, [editor]), /permission denied/);
    await assert.rejects(
      db.query("update public.xp_ledger set xp=500"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("update public.profiles set username='other' where id=$1", [
        alice,
      ]),
      /permission denied/,
    );
    const t = await rpc("v1_admin_save", [
      "tournament",
      {
        name: "Editor cup",
        season_id: season,
        starts_at: "2026-01-01",
        ends_at: "2099-01-01",
      },
    ]);
    await assert.rejects(
      rpc("v1_admin_save", ["publish_tournament", { id: t }]),
      /Add at least one match/,
    );
    const m = await rpc("v1_admin_save", [
      "match",
      {
        tournament_id: t,
        athlete_a: "Editor A",
        athlete_b: "Editor B",
        closes_at: "2026-01-01",
      },
    ]);
    await assert.rejects(
      rpc("v1_admin_save", ["publish_tournament", { id: t }]),
      /Publish at least one quiz/,
    );
    const q = await rpc("v1_admin_save", [
      "quiz",
      {
        tournament_id: t,
        title: "Editor quiz",
        opens_at: "2026-01-01",
        closes_at: "2099-01-01",
      },
    ]);
    await assert.rejects(
      rpc("v1_admin_save", ["publish_quiz", { id: q }]),
      /Add at least one question/,
    );
    const fields = {
      quiz_id: q,
      position: 1,
      prompt: "Editor question?",
      options: ["A", "B", "C", "D"],
      correct_option: 0,
      explanation: "A wins.",
    };
    const question = await rpc("v1_admin_save", ["question", fields]);
    await assert.rejects(
      rpc("v1_admin_save", ["publish_quiz", { id: q }]),
      /Number questions consecutively from 1/,
    );
    await rpc("v1_admin_save", [
      "question",
      { ...fields, id: question, position: 0, prompt: "Corrected question?" },
    ]);
    assert.equal(
      (await rpc("v1_admin_snapshot")).questions.find((x) => x.id === question)
        .prompt,
      "Corrected question?",
    );
    await rpc("v1_admin_save", ["publish_quiz", { id: q }]);
    await rpc("v1_admin_save", ["publish_tournament", { id: t }]);
    await assert.rejects(
      rpc("v1_admin_save", ["question", { ...fields, id: question }]),
      /Published questions/,
    );
    await rpc("v1_settle_match", [m, "Editor A"]);
    await rpc("v1_settle_match", [m, "Editor A"]);
  });
});
