import assert from "node:assert/strict";
import { test } from "node:test";
import { landingArena } from "../src/launch/arena.ts";

const config = {
  ready: true,
  url: "https://example.test",
  key: "public-test-key",
};
const home = {
  server_now: "2026-11-18T00:00:00Z",
  tournament: {
    id: "event",
    name: "Hong Kong Open",
    starts_at: "2026-11-17T00:00:00Z",
    ends_at: "2026-11-23T00:00:00Z",
    hero_image_url: "https://example.test/arena.webp",
  },
  quizzes: [
    { opens_at: "2026-11-18T04:00:00Z", closes_at: "2026-11-18T08:00:00Z" },
  ],
  matches: [],
};

test("landing derives the live day, next challenge and podium from the current tournament", async () => {
  const podium = ["MY", "JP", "DK", "TH"].map((id, i) => ({
    id,
    xp: 40 - i * 10,
    name: id,
  }));
  const arena = await landingArena(config, async (url, options) => {
    assert.equal(options.headers.apikey, config.key);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    if (url.pathname.endsWith("v1_home")) return Response.json(home);
    return Response.json({
      tournament_id: "event",
      boards: { countries: podium },
    });
  });
  assert.equal(arena.name, "Hong Kong Open");
  assert.equal(arena.hero, home.tournament.hero_image_url);
  assert.equal(arena.live, true);
  assert.equal(arena.day, 2);
  assert.equal(arena.totalDays, 6);
  assert.equal(arena.deadline, Date.parse(home.quizzes[0].opens_at));
  assert.equal(arena.timerLabel, "Next challenge opens in");
  assert.deepEqual(arena.countries, podium.slice(0, 3));
});

test("landing falls back safely when configuration or tournament is missing and ignores stale rankings", async () => {
  assert.equal(await landingArena({ ready: false }), null);
  assert.equal(
    await landingArena(config, async () => new Response(null, { status: 503 })),
    null,
  );
  const arena = await landingArena(config, async (url) =>
    Response.json(
      url.pathname.endsWith("v1_home")
        ? home
        : {
            tournament_id: "old-event",
            boards: { countries: [{ id: "MY", xp: 100 }] },
          },
    ),
  );
  assert.deepEqual(arena.countries, []);
});
