import assert from "node:assert/strict";
import { test } from "node:test";
import { landingHeroUrl } from "../src/launch/hero.ts";

const config = {
  ready: true,
  url: "https://example.test",
  key: "public-test-key",
};

test("landing reads only the active, published tournament’s public artwork", async () => {
  const artwork = "https://example.test/artwork.webp";
  const image = await landingHeroUrl(config, async (url, options) => {
    assert.equal(url.pathname, "/rest/v1/tournaments");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      select: "hero_image_url",
      active: "eq.true",
      published: "eq.true",
      limit: "1",
    });
    assert.equal(options.headers.apikey, config.key);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json([{ hero_image_url: artwork }]);
  });
  assert.equal(image, artwork);
});

test("landing falls back when artwork or configuration is unavailable", async () => {
  assert.equal(await landingHeroUrl({ ready: false }), null);
  for (const rows of [
    [],
    [{ hero_image_url: null }],
    [{ hero_image_url: "http://example.test/art" }],
  ]) {
    assert.equal(
      await landingHeroUrl(config, async () => Response.json(rows)),
      null,
    );
  }
  assert.equal(
    await landingHeroUrl(
      config,
      async () => new Response(null, { status: 503 }),
    ),
    null,
  );
});
