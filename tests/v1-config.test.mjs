import { test } from "node:test";
import assert from "node:assert/strict";
import { publicV1Config } from "../src/v1/config.ts";
const jwt = (role) =>
  [
    "header",
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "test-only",
  ].join(".");
const env = {
  V1_ISOLATED_TEST_PROJECT: "true",
  V1_SUPABASE_URL: "http://127.0.0.1:54321",
  V1_SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
};
test("v1 configuration fails closed without isolated-project opt-in and never falls back to legacy config", () => {
  assert.deepEqual(publicV1Config({}), { ready: false });
  assert.deepEqual(
    publicV1Config({ ...env, V1_ISOLATED_TEST_PROJECT: undefined }),
    { ready: false },
  );
  assert.deepEqual(
    publicV1Config({
      NEXT_PUBLIC_SUPABASE_URL: env.V1_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: env.V1_SUPABASE_PUBLISHABLE_KEY,
    }),
    { ready: false },
  );
  assert.equal(publicV1Config(env).ready, true);
});
test("v1 public config rejects secret/service-role keys and insecure remote URLs", () => {
  for (const role of ["service_role", "authenticated"])
    assert.deepEqual(
      publicV1Config({ ...env, V1_SUPABASE_PUBLISHABLE_KEY: jwt(role) }),
      { ready: false },
    );
  assert.deepEqual(
    publicV1Config({
      ...env,
      V1_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test-placeholder",
    }),
    { ready: false },
  );
  assert.deepEqual(
    publicV1Config({ ...env, V1_SUPABASE_URL: "http://example.test" }),
    { ready: false },
  );
  assert.deepEqual(publicV1Config({ ...env, V1_SUPABASE_URL: "invalid" }), {
    ready: false,
  });
  assert.equal(
    publicV1Config({
      ...env,
      V1_SUPABASE_URL: "https://example.supabase.co",
      V1_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-placeholder",
    }).ready,
    true,
  );
});
