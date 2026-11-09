import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import config from "../next.config.ts";

test("cPanel configuration enables standalone output and canonical www and account redirects", async () => {
  assert.equal(config.output, "standalone");
  assert.equal(config.typescript.ignoreBuildErrors, false);
  assert.equal(config.eslint.ignoreDuringBuilds, false);
  assert.deepEqual(await config.redirects(), [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.badmintonxp.com" }],
      destination: "https://badmintonxp.com/:path*",
      permanent: false,
    },
    { source: "/", destination: "/play", permanent: false },
  ]);
});
test("cPanel build refuses dotenv files before any build can inline their values", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "badmintonxp-env-guard-"));
  try {
    writeFileSync(path.join(dir, ".env.local"), "# test fixture only\n");
    const result = spawnSync(
      process.execPath,
      [path.resolve("scripts/build-cpanel.mjs")],
      { cwd: dir, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No values were read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
