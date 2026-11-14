import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseConnected } from "../src/v1/health.ts";
const config = {
  ready: true,
  url: "https://example.supabase.co",
  key: "sb_publishable_test-placeholder",
};
test("health performs a no-cache, bounded read with only the public key and a timeout", async () => {
  for (const rows of [[], [{ id: "test-season" }]]) {
    const result = await databaseConnected(config, async (url, options) => {
      assert.equal(
        String(url),
        "https://example.supabase.co/rest/v1/seasons?select=id&limit=1",
      );
      assert.deepEqual(options.headers, { apikey: config.key });
      assert.equal(options.cache, "no-store");
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(JSON.stringify(rows));
    });
    assert.equal(result, true);
  }
});
test("health fails closed without configuration and never makes a request", async () => {
  assert.equal(
    await databaseConnected({ ready: false }, async () => {
      throw new Error("Unexpected request");
    }),
    false,
  );
});
test("health returns only false on HTTP errors, malformed responses or sensitive backend errors", async () => {
  for (const fetcher of [
    async () => new Response("private database error", { status: 500 }),
    async () => new Response("{invalid json"),
    async () =>
      new Response(JSON.stringify({ error: "private server detail" })),
    async () => {
      throw new Error("private connection details");
    },
  ])
    assert.equal(await databaseConnected(config, fetcher), false);
});
