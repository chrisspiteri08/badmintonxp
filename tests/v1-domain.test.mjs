import { test } from "node:test";
import assert from "node:assert/strict";
import { emailReturnUrl, tournamentPublicationHeld } from "../src/v1/domain.ts";
test("email links use the canonical HTTPS domain for apex and www; local PKCE stays local", () => {
  for (const origin of [
    "https://badmintonxp.com",
    "https://www.badmintonxp.com",
    "http://www.badmintonxp.com",
  ]) {
    assert.equal(
      emailReturnUrl(origin, "account"),
      "https://badmintonxp.com/play/account",
    );
    assert.equal(
      emailReturnUrl(origin, "reset"),
      "https://badmintonxp.com/play/reset",
    );
  }
  assert.equal(
    emailReturnUrl("http://127.0.0.1:3100", "account"),
    "http://127.0.0.1:3100/play/account",
  );
  assert.equal(
    emailReturnUrl("http://localhost:3100", "reset"),
    "http://localhost:3100/play/reset",
  );
});
test("World Tour Finals 2026 publication hold is case/whitespace insensitive", () => {
  assert.equal(tournamentPublicationHeld("World Tour Finals 2026"), true);
  assert.equal(tournamentPublicationHeld("  WORLD   TOUR FINALS 2026 "), true);
  assert.equal(tournamentPublicationHeld("World Tour Finals 2027"), false);
});
