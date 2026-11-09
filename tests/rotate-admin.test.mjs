import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rotateWithClient,
  ADMIN_EMAIL,
} from "../scripts/rotate-admin-password.mjs";
function mock({
  found = true,
  confirmed = true,
  updateFails = false,
  signInFails = false,
  signOutFails = false,
} = {}) {
  const calls = [];
  const client = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: found
              ? [
                  {
                    id: "test-user-id",
                    email: ADMIN_EMAIL,
                    email_confirmed_at: confirmed ? "confirmed" : null,
                  },
                ]
              : [],
          },
          error: null,
        }),
        updateUserById: async (id, attributes) => {
          calls.push(["update", id, attributes]);
          return { error: updateFails ? {} : null };
        },
      },
      signInWithPassword: async (credentials) => {
        calls.push(["signIn", credentials]);
        return { error: signInFails ? {} : null };
      },
      signOut: async (options) => {
        calls.push(["signOut", options]);
        return { error: signOutFails ? {} : null };
      },
    },
  };
  return { client, calls };
}
test("owner helper updates only the target account and globally revokes its sessions", async () => {
  const { client, calls } = mock();
  const input = Symbol("mock-secret");
  await rotateWithClient(client, input);
  assert.equal(calls[0][0], "update");
  assert.equal(calls[0][1], "test-user-id");
  assert.equal(calls[0][2].password, input);
  assert.equal(calls[1][1].email, ADMIN_EMAIL);
  assert.equal(calls[1][1].password, input);
  assert.deepEqual(calls[2], ["signOut", { scope: "global" }]);
});
test("missing/unconfirmed account does not trigger credential writes", async () => {
  for (const options of [{ found: false }, { confirmed: false }]) {
    const { client, calls } = mock(options);
    await assert.rejects(
      rotateWithClient(client, Symbol("mock-secret")),
      /Nothing changed/,
    );
    assert.equal(calls.length, 0);
  }
});
test("failed updates stop; partial session-revocation failures are reported truthfully", async () => {
  let m = mock({ updateFails: true });
  await assert.rejects(
    rotateWithClient(m.client, Symbol("mock-secret")),
    /No successful password change/,
  );
  assert.equal(m.calls.length, 1);
  m = mock({ signInFails: true });
  await assert.rejects(
    rotateWithClient(m.client, Symbol("mock-secret")),
    /Password changed, but session revocation/,
  );
  assert.equal(m.calls.length, 2);
  m = mock({ signOutFails: true });
  await assert.rejects(
    rotateWithClient(m.client, Symbol("mock-secret")),
    /Password changed, but global sign-out/,
  );
});
