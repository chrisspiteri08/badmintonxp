import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fixture, local, password, sql } from "./local";
async function mailLink(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  subject: string,
) {
  const { mail } = local();
  let id = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mail}/api/v1/messages`);
        const json = await response.json();
        const message = json.messages?.find(
          (m: {
            To: Array<{ Address: string }>;
            Subject: string;
            ID: string;
          }) =>
            m.To?.some((to) => to.Address === email) &&
            m.Subject.includes(subject),
        );
        id = message?.ID || "";
        return !!id;
      },
      { timeout: 20000 },
    )
    .toBe(true);
  const response = await request.get(`${mail}/api/v1/message/${id}`);
  const message = await response.json();
  const link = String(message.HTML || message.Text)
    .match(/https?:\/\/[^\s"<>]*\/auth\/v1\/verify[^\s"<>]*/)?.[0]
    ?.replaceAll("&amp;", "&");
  if (!link) throw new Error("No local confirmation link found.");
  return link;
}
test("real signup, email confirmation, profile, server quiz, locked prediction and shared rankings", async ({
  page,
  request,
}, info) => {
  const tag = randomUUID().slice(0, 8);
  const f = await fixture(tag);
  const email = `fan-${tag}@example.test`,
    pass = password(),
    username = `fan_${tag}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/play/account");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  await page.goto(await mailLink(request, email, "Confirm"));
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();
  await page.getByRole("link", { name: "Set up your profile" }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("MY");
  await page
    .getByRole("combobox", { name: "Team", exact: true })
    .selectOption(f.team);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Player profile saved");
  await page.goto("/play/admin");
  await expect(
    page.getByRole("heading", { name: "Players’ side." }),
  ).toBeVisible();
  await page.goto("/play");
  await expect(
    page.getByRole("heading", { name: `Isolated Cup ${tag}` }),
  ).toBeVisible();
  await page.screenshot({
    path: path.resolve(
      `../../outputs/v1-screenshots/${info.project.name}-home.png`,
    ),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByTestId("v1-question")).toContainText("Round 1");
  await page.screenshot({
    path: path.resolve(
      `../../outputs/v1-screenshots/${info.project.name}-quiz.png`,
    ),
    fullPage: true,
  });
  // No answer key in any player question response before an answer is locked.
  const payload = await page.evaluate(async (id) => {
    const c = await fetch("/api/v1/config").then((r) => r.json());
    const raw = JSON.parse(localStorage.getItem("badmintonxp-v1-auth")!);
    const r = await fetch(c.url + "/rest/v1/rpc/v1_quiz", {
      method: "POST",
      headers: {
        apikey: c.key,
        Authorization: "Bearer " + raw.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_quiz_id: id, p_action: "resume" }),
    });
    return r.json();
  }, f.quiz);
  expect(payload.question.correct_option).toBeUndefined();
  expect(payload.answers).toEqual([]);
  await page.getByRole("button", { name: "C 16", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Clean winner." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "A 12", exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "C 16", exact: true }).click();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  await page.reload();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  await expect(page.getByTestId("v1-lifetime-xp")).toHaveText("20 XP");
  await page.getByRole("link", { name: "Make your match call" }).click();
  await page.getByRole("button", { name: /01 Ember/ }).click();
  await page.getByRole("button", { name: "Lock Ember", exact: true }).click();
  await expect(page.getByTestId("v1-prediction-status")).toContainText(
    "Your Ember pick is locked",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: /02 Kite/ })).toBeDisabled();
  sql(
    `update public.matches set closes_at=clock_timestamp()-interval '1 second' where id='${f.match}';`,
  );
  const settled = await f.owner.rpc("v1_settle_match", {
    p_match_id: f.match,
    p_winner: "Ember",
  });
  expect(settled.error).toBeNull();
  await f.owner.rpc("v1_settle_match", {
    p_match_id: f.match,
    p_winner: "Ember",
  });
  await page.reload();
  await expect(page.getByTestId("v1-prediction-status")).toHaveText(
    "Ember wins! You called it. +20 XP",
  );
  await expect(page.getByTestId("v1-lifetime-xp")).toHaveText("40 XP");
  await page.getByRole("link", { name: "Rankings", exact: true }).click();
  await expect(page.getByTestId("v1-standings")).toContainText(username);
  await expect(page.getByTestId("v1-standings")).toContainText("40");
  await page.getByRole("button", { name: "Teams", exact: true }).click();
  await expect(page.getByTestId("v1-standings")).toContainText(`Neon ${tag}`);
  await page.getByRole("button", { name: "Countries", exact: true }).click();
  await expect(page.getByTestId("v1-standings")).toContainText("MY");
  await page.getByRole("button", { name: "Season", exact: true }).click();
  await expect(page.getByTestId("v1-standings")).toContainText("40");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.resolve(
      `../../outputs/v1-screenshots/${info.project.name}-rankings.png`,
    ),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Sign out all sessions" }).click();
  await expect(
    page.getByRole("heading", { name: "Join the rally." }),
  ).toBeVisible();
  await page.goto("/play/standings");
  await page.getByRole("button", { name: "Individuals", exact: true }).click();
  await expect(page.getByTestId("v1-standings")).toContainText(username);
  // Real Auth login and password recovery through the local mail server.
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();
  await page.goto("/play/profile");
  await page.getByRole("button", { name: "Sign out all sessions" }).click();
  await expect(
    page.getByRole("heading", { name: "Join the rally." }),
  ).toBeVisible();
  await page.goto("/play/account");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link");
  await page.goto(await mailLink(request, email, "Reset"));
  const nextPass = password();
  await page.getByLabel("New password", { exact: true }).fill(nextPass);
  await page.getByLabel("Confirm password", { exact: true }).fill(nextPass);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Password updated" }),
  ).toBeVisible();
  const after = local().player();
  expect(
    (await after.auth.signInWithPassword({ email, password: nextPass })).error,
  ).toBeNull();
  expect(errors).toEqual([]);
});
test("admin desk is role guarded and saves unpublished tournament drafts", async ({
  page,
}, info) => {
  const tag = randomUUID().slice(0, 8),
    f = await fixture(tag);
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();
  await page.goto("/play/admin");
  await expect(
    page.getByRole("heading", { name: "Set the stage." }),
  ).toBeVisible();
  await page.getByText("3. Create a tournament", { exact: true }).click();
  await page
    .getByLabel("Tournament name", { exact: true })
    .fill(`Unpublished ${tag}`);
  await page
    .getByRole("combobox", { name: "Season", exact: true })
    .selectOption({ label: `Test season ${tag}` });
  await page
    .getByLabel("Tournament starts", { exact: true })
    .fill("2027-01-01T12:00");
  await page
    .getByLabel("Tournament ends", { exact: true })
    .fill("2027-01-03T12:00");
  await page
    .getByRole("button", { name: "Save tournament", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved as a draft");
  await expect(
    page.getByRole("heading", { name: `Unpublished ${tag} · Draft` }),
  ).toBeVisible();
  expect(
    (
      await local()
        .player()
        .from("tournaments")
        .select("*")
        .eq("name", `Unpublished ${tag}`)
    ).data,
  ).toEqual([]);
  await page.screenshot({
    path: path.resolve(
      `../../outputs/v1-screenshots/${info.project.name}-admin.png`,
    ),
    fullPage: true,
  });
});

test("server timeout advances a real unanswered question and saves the final score", async ({
  page,
}) => {
  const tag = randomUUID().slice(0, 8),
    f = await fixture(tag);
  const c = local();
  const email = `timer-${tag}@example.test`,
    pass = password();
  expect(
    (
      await c.admin.auth.admin.createUser({
        email,
        password: pass,
        email_confirm: true,
      })
    ).error,
  ).toBeNull();
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();
  await page.goto("/play/quiz");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByTestId("v1-question")).toContainText("Round 1");
  await expect(page.getByTestId("v1-question")).toContainText("Round 2", {
    timeout: 22000,
  });
  await page.getByRole("button", { name: "C 16", exact: true }).click();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "C 16", exact: true }).click();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  await expect(
    page.getByText("Q1 · Timed out · 0 XP", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  const attempt = await f.admin
    .from("attempts")
    .select("id")
    .eq("quiz_id", f.quiz);
  expect(attempt.data).toHaveLength(1);
});
