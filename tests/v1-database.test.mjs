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
  await db.exec(`
    create schema storage;
    create table storage.buckets(
      id text primary key, name text not null, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects(name text not null, bucket_id text references storage.buckets(id));
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
  `);
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
  assert.equal(tables.length, 17);
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

test("published tournaments accept future matches and freeze the champions using top-ten scores", async () => {
  await db.exec("begin");
  try {
    const payload = {
      tournament_id: tournament,
      athlete_a: "Aster",
      athlete_b: "Blaze",
    };
    const featured = await asUser(admin, async () => {
      await db.exec("savepoint rejected_match");
      await assert.rejects(
        rpc("v1_admin_save", [
          "match",
          { ...payload, closes_at: "2020-01-01T00:00:00Z" },
        ]),
        /future/,
      );
      await db.exec("rollback to savepoint rejected_match");
      return rpc("v1_admin_save", [
        "match",
        { ...payload, closes_at: "2099-01-01T00:00:00Z" },
      ]);
    });
    await db.exec("update public.tournaments set active=false where active");
    await db.query("update public.tournaments set active=true where id=$1", [
      tournament,
    ]);
    for (let index = 1; index <= 11; index++) {
      const id = `7${String(index).padStart(7, "0")}-0000-0000-0000-000000000000`;
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        `rank${index}@example.test`,
      ]);
      await db.query(
        "insert into public.xp_ledger(user_id,tournament_id,season_id,team_id,country,source_type,source_id,xp) values($1,$2,$3,$4,'JP','quiz',gen_random_uuid(),$5)",
        [id, tournament, season, team, index * 30],
      );
    }
    await db.query(
      "update public.tournaments set ends_at=clock_timestamp()+interval '1 second' where id=$1",
      [tournament],
    );
    await db.query(
      "update public.tournaments set ends_at=clock_timestamp()-interval '1 millisecond' where id=$1",
      [tournament],
    );
    const read = () =>
      asUser(null, () => rpc("v1_tournament_rankings"), "anon");
    await asUser(admin, async () => {
      await db.exec("savepoint ended_event");
      await assert.rejects(
        rpc("v1_admin_save", [
          "match",
          { ...payload, closes_at: "2099-01-02T00:00:00Z" },
        ]),
        /finished/,
      );
      await db.exec("rollback to savepoint ended_event");
    });
    const pending = await read();
    assert.equal(pending.final, false);
    const country = pending.boards.countries.find((row) => row.id === "JP");
    assert.equal(country.xp, 1950);
    assert.equal(country.fans, 11);
    const teamXp = (
      await db.query(
        "select sum(xp) as xp from (select sum(xp) xp from public.xp_ledger where tournament_id=$1 and team_id=$2 group by user_id order by xp desc limit 10) top_fans",
        [tournament, team],
      )
    ).rows[0].xp;
    assert.equal(
      pending.boards.teams.find((row) => row.id === team).xp,
      Number(teamXp),
    );
    await db.query(
      "update public.matches set winner=athlete_a,settled_at=clock_timestamp() where tournament_id=$1 and winner is null",
      [tournament],
    );
    await db.exec("savepoint empty_event");
    await db.query("update public.xp_ledger set xp=0 where tournament_id=$1", [
      tournament,
    ]);
    assert.equal((await read()).final, false);
    assert.equal(
      (
        await db.query(
          "select 1 from private.tournament_results where tournament_id=$1",
          [tournament],
        )
      ).rows.length,
      0,
    );
    await db.exec("rollback to savepoint empty_event");
    await db.query(
      "insert into public.xp_ledger(user_id,tournament_id,season_id,country,source_type,source_id,xp) values($1,$2,$3,'DK','quiz',gen_random_uuid(),330)",
      [admin, tournament, season],
    );
    const result = await read();
    assert.equal(result.final, true);
    assert.equal(result.boards.players[0].xp, 330);
    assert.equal(result.boards.countries[0].id, "JP");
    await db.query("update public.xp_ledger set xp=0 where tournament_id=$1", [
      tournament,
    ]);
    assert.deepEqual((await read()).boards, result.boards);
    await db.query(
      "update public.tournaments set ends_at=clock_timestamp()+interval '1 day' where id=$1",
      [tournament],
    );
    await asUser(admin, async () => {
      await db.exec("savepoint rejected_match");
      await assert.rejects(
        rpc("v1_admin_save", [
          "match",
          { ...payload, closes_at: "2099-01-02T00:00:00Z" },
        ]),
        /finished/,
      );
      await db.exec("rollback to savepoint rejected_match");
    });
    await db.query("update public.tournaments set active=false where id=$1", [
      tournament,
    ]);
    const history = (await read()).past.find(
      (event) => event.id === tournament,
    );
    assert.equal(history.winners.countries[0].id, "JP");
    assert.deepEqual(
      history.winners.players.map((winner) => winner.xp),
      [330, 330],
    );
    assert.ok(featured);
  } finally {
    await db.exec("rollback");
  }
});

test("tournament desk saves accessible hero art and scheduled predictions remain locked", async () => {
  const hero = {
    tournament_id: tournament,
    city: "Hong Kong",
    hero_image_url: "https://example.test/court.jpg",
    hero_image_alt: "Badminton court in Hong Kong",
  };
  await asUser(alice, () =>
    assert.rejects(
      rpc("v1_admin_save", ["tournament_hero", hero]),
      /desk access/,
    ),
  );
  const featured = await asUser(admin, async () => {
    await assert.rejects(
      rpc("v1_admin_save", [
        "tournament_hero",
        { ...hero, hero_image_alt: "" },
      ]),
      /Check the fields/,
    );
    assert.equal(
      await rpc("v1_admin_save", ["tournament_hero", hero]),
      tournament,
    );
    return rpc("v1_admin_save", [
      "match",
      {
        tournament_id: tournament,
        athlete_a: "Orchid",
        athlete_b: "Maple",
        opens_at: "2098-12-30T00:00:00Z",
        closes_at: "2099-01-01T00:00:00Z",
      },
    ]);
  });
  await asUser(alice, () =>
    assert.rejects(rpc("v1_predict", [featured, "Orchid"]), /not open yet/),
  );
  assert.deepEqual(
    await scalar(
      "select city,hero_image_url,hero_image_alt from public.tournaments where id=$1",
      [tournament],
    ),
    {
      city: hero.city,
      hero_image_url: hero.hero_image_url,
      hero_image_alt: hero.hero_image_alt,
    },
  );
});

test("push devices are private and only owner admins can list or remove expired recipients", async () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/test-device";
  const keys = { p256dh: "A".repeat(87), auth: "B".repeat(22) };
  await asUser(alice, async () => {
    await db.query(
      "insert into public.push_subscriptions(user_id,endpoint,keys) values ($1,$2,$3)",
      [alice, endpoint, keys],
    );
    assert.equal(
      (await db.query("select endpoint from public.push_subscriptions")).rows[0]
        .endpoint,
      endpoint,
    );
    await assert.rejects(
      db.query(
        "insert into public.push_subscriptions(user_id,endpoint,keys) values($1,$2,$3)",
        [bob, endpoint + "-other", keys],
      ),
      /row-level security/,
    );
  });
  await asUser(bob, async () => {
    assert.equal(
      (await db.query("select * from public.push_subscriptions")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "delete from public.push_subscriptions where endpoint=$1 returning endpoint",
          [endpoint],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(rpc("v1_push_recipients"), /Admin access required/);
  });
  await asUser(
    null,
    () =>
      assert.rejects(
        db.query("select * from public.push_subscriptions"),
        /permission denied/,
      ),
    "anon",
  );
  await asUser(admin, async () => {
    assert.deepEqual(
      (await db.query("select * from public.v1_push_recipients()")).rows,
      [{ endpoint, keys }],
    );
    await db.query("select * from public.v1_push_recipients(p_expired => $1)", [
      [endpoint],
    ]);
    assert.equal(
      (await db.query("select * from public.v1_push_recipients()")).rows.length,
      0,
    );
  });
});

test("tournament hero storage allows public reads and only editors or admins can write", async () => {
  const bucket = "tournament-heroes";
  const editor = "64000000-0000-0000-0000-000000000004";
  const write = (name, target = bucket) =>
    db.query("insert into storage.objects(name,bucket_id) values($1,$2)", [
      name,
      target,
    ]);
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    editor,
    "hero-editor@example.test",
  ]);
  await db.query("insert into private.content_editors(user_id) values($1)", [
    editor,
  ]);
  assert.deepEqual(
    await scalar(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id=$1",
      [bucket],
    ),
    {
      public: true,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/webp"],
    },
  );
  await db.exec(
    "insert into storage.buckets(id,name) values ('other-bucket','other-bucket')",
  );
  await write("private.webp", "other-bucket");
  await asUser(admin, () => write("court.webp"));
  await asUser(editor, async () => {
    await write("second.webp");
    assert.equal(
      (
        await db.query(
          "update storage.objects set name='renamed.webp' where name='court.webp' returning name",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      write("outside.webp", "other-bucket"),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "update storage.objects set bucket_id='other-bucket' where name='renamed.webp'",
      ),
      /row-level security/,
    );
  });
  await asUser(
    null,
    async () => {
      assert.deepEqual(
        (await db.query("select name from storage.objects order by name")).rows,
        [{ name: "renamed.webp" }, { name: "second.webp" }],
      );
      await assert.rejects(write("anonymous.webp"), /row-level security/);
    },
    "anon",
  );
  await asUser(alice, async () => {
    await assert.rejects(write("fan.webp"), /row-level security/);
    assert.equal(
      (
        await db.query(
          "update storage.objects set name='edited.webp' returning name",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from storage.objects returning name")).rows
        .length,
      0,
    );
  });
  await asUser(editor, async () => {
    assert.equal(
      (await db.query("delete from storage.objects returning name")).rows
        .length,
      2,
    );
  });
});
