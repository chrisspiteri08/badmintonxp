import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
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
    pass = randomBytes(6).toString("base64url").slice(0, 6),
    username = `fan_${tag}`;
  const capture = (screen: string) =>
    page.screenshot({
      path: path.resolve(
        process.env.V1_SCREENSHOT_DIR || "../../outputs/v1-screenshots",
        `${info.project.name}-${screen}.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });
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
  await capture("home");
  if (info.project.name === "mobile") {
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const footer = await page.getByRole("contentinfo").boundingBox();
    const tabs = await page
      .getByRole("navigation", { name: "Fan arena" })
      .boundingBox();
    expect(footer!.y + footer!.height).toBeLessThan(tabs!.y);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.getByRole("link", { name: "Quiz", exact: true }).click();
  await expect(page.getByRole("group", { name: "Choose a quiz" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByTestId("v1-question")).toContainText("Round 1");
  if (info.project.name === "mobile") {
    const lastAnswer = await page
      .getByRole("button", { name: "D 18", exact: true })
      .boundingBox();
    const tabs = await page
      .getByRole("navigation", { name: "Fan arena" })
      .boundingBox();
    expect(lastAnswer!.y + lastAnswer!.height).toBeLessThan(tabs!.y);
  }
  await capture("quiz");
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
  await expect(page.getByText("1 streak", { exact: true })).toBeVisible();
  await expect(page.locator(".result-correct")).toContainText("+10 XP");
  await capture("quiz-correct");
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "A 12", exact: true }).click();
  await expect(page.locator(".result-wrong")).toContainText("Not this rally.");
  await expect(page.getByText("0 streak", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "C 16", exact: true }).click();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  await page.reload();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  await expect(page.getByTestId("v1-lifetime-xp")).toHaveText("20 XP");
  await page.getByRole("link", { name: "Make your match call" }).click();
  await expect(page.getByRole("button", { name: /01 Ember/ })).toBeEnabled();
  await capture("predict");
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
  await capture("rankings");
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
  const nextPass = randomBytes(6).toString("base64url").slice(0, 6);
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
  await expect(
    page.getByRole("status").filter({ hasText: "Saved as a draft" }),
  ).toBeVisible();
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
  await page
    .getByLabel("Tournament name", { exact: true })
    .fill("World Tour Finals 2026");
  await page
    .getByRole("button", { name: "Save tournament", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", {
        name: "Publication on hold: World Tour Finals 2026",
        exact: true,
      })
      .first(),
  ).toBeDisabled();
  await page.screenshot({
    path: path.resolve(
      `../../outputs/v1-screenshots/${info.project.name}-admin.png`,
    ),
    fullPage: true,
  });
});

test("server timeout advances a real unanswered question and saves the final score", async ({
  page,
}, info) => {
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
  await expect(page.getByRole("timer")).toHaveClass(/urgent/, {
    timeout: 17000,
  });
  await expect(page.getByTestId("v1-question")).toContainText("Round 2", {
    timeout: 22000,
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Time’s up!" }),
  ).toBeVisible();
  if (info.project.name === "mobile") {
    const lastAnswer = await page
      .getByRole("button", { name: "D 18", exact: true })
      .boundingBox();
    const tabs = await page
      .getByRole("navigation", { name: "Fan arena" })
      .boundingBox();
    expect(lastAnswer!.y + lastAnswer!.height).toBeLessThan(tabs!.y);
  }
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

test("content editor sees readiness, repairs a draft question and publishes/settles without player access", async ({
  page,
}, info) => {
  const tag = randomUUID().slice(0, 8),
    f = await fixture(tag),
    ctx = local(),
    email = `editor-ui-${tag}@example.test`,
    pass = password();
  const created = await ctx.admin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  sql(
    `insert into private.content_editors(user_id) values('${created.data.user!.id}');`,
  );
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();
  await page.goto("/play/admin");
  await expect(
    page.getByText(/Content editor — content and results only/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Players", exact: true }),
  ).toHaveCount(0);
  const tname = `Editor UI event ${tag}`,
    qname = `Editor UI quiz ${tag}`;
  await page.getByText("3. Create a tournament", { exact: true }).click();
  const tf = page.getByRole("form", { name: "3. Create a tournament" });
  await tf.getByLabel("Tournament name", { exact: true }).fill(tname);
  await tf
    .getByRole("combobox", { name: "Season", exact: true })
    .selectOption({ label: `Test season ${tag}` });
  await tf
    .getByLabel("Tournament starts", { exact: true })
    .fill("2026-01-01T00:00");
  await tf
    .getByLabel("Tournament ends", { exact: true })
    .fill("2099-01-01T00:00");
  await tf
    .getByRole("button", { name: "Save tournament", exact: true })
    .click();
  const tr = page.locator(`[aria-label="Tournament readiness: ${tname}"]`);
  await expect(tr).toContainText("Add at least one match");
  await expect(tr).toContainText("Publish at least one quiz");
  await expect(
    page.getByRole("button", {
      name: `Publish tournament: ${tname}`,
      exact: true,
    }),
  ).toBeDisabled();
  const t = await ctx.admin
    .from("tournaments")
    .select("id")
    .eq("name", tname)
    .single();
  expect(t.error).toBeNull();
  await page.getByText("4. Add a match", { exact: true }).click();
  const mf = page.getByRole("form", { name: "4. Add a match" });
  await mf
    .getByRole("combobox", { name: "Tournament", exact: true })
    .selectOption(t.data!.id);
  await mf
    .getByLabel("First athlete or pair", { exact: true })
    .fill(`Ember ${tag}`);
  await mf
    .getByLabel("Second athlete or pair", { exact: true })
    .fill(`Kite ${tag}`);
  await mf
    .getByLabel("Predictions close", { exact: true })
    .fill("2026-01-01T00:00");
  await mf.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(tr).not.toContainText("Add at least one match");
  await page.getByText("5. Create a quiz", { exact: true }).click();
  const qf = page.getByRole("form", { name: "5. Create a quiz" });
  await qf
    .getByRole("combobox", { name: "Tournament", exact: true })
    .selectOption(t.data!.id);
  await qf.getByLabel("Quiz title", { exact: true }).fill(qname);
  await qf.getByLabel("Quiz opens", { exact: true }).fill("2026-01-01T00:00");
  await qf
    .getByLabel("Quiz entries close", { exact: true })
    .fill("2099-01-01T00:00");
  await qf.getByRole("button", { name: "Save quiz", exact: true }).click();
  const qr = page.locator(`[aria-label="Quiz readiness: ${qname}"]`);
  await expect(qr).toContainText("Add at least one question");
  const q = await ctx.admin
    .from("quizzes")
    .select("id")
    .eq("title", qname)
    .single();
  expect(q.error).toBeNull();
  await page.getByText("6. Write a quiz question", { exact: true }).click();
  const form = page.getByRole("form", { name: "6. Write a quiz question" });
  await form
    .getByRole("combobox", { name: "Quiz", exact: true })
    .selectOption(q.data!.id);
  await form.getByLabel("Question number", { exact: true }).fill("2");
  await form
    .getByLabel("Question", { exact: true })
    .fill("Which local test answer wins?");
  for (let i = 1; i <= 4; i++)
    await form.getByLabel(`Answer ${i}`, { exact: true }).fill(`Option ${i}`);
  await form
    .getByLabel("Explanation", { exact: true })
    .fill("Option one wins.");
  await form
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await expect(qr).toContainText("Number questions consecutively from 1");
  await expect(
    page.getByRole("button", { name: `Publish quiz: ${qname}`, exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: `Edit question 2: ${qname}`, exact: true })
    .click();
  await expect(form.getByLabel("Question number", { exact: true })).toHaveValue(
    "2",
  );
  await form.getByLabel("Question number", { exact: true }).fill("1");
  await form
    .getByRole("button", { name: "Save question changes", exact: true })
    .click();
  await expect(qr).toContainText("Ready to publish this quiz");
  await page
    .getByRole("button", { name: `Publish quiz: ${qname}`, exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Quiz published." }),
  ).toContainText("tournament is published");
  await expect(tr).toContainText("Ready to publish");
  await page
    .getByRole("button", { name: `Publish tournament: ${tname}`, exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Tournament published" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Ember ${tag} wins`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm winner", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Result confirmed" }),
  ).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(f.email);
  await page.screenshot({
    path: path.resolve(`../../outputs/content-editor-${info.project.name}.png`),
    fullPage: true,
  });
});

test("game HUD waits for the account, celebrates levels, and pins live rank movement", async ({
  page,
}, info) => {
  const f = await fixture(randomUUID().slice(0, 8));
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();

  let xp = 990;
  let release!: () => void;
  const delayedHome = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/rpc/v1_home", async (route) => {
    await delayedHome;
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), lifetime_xp: xp },
    });
  });
  await page.goto("/play");
  try {
    await expect(
      page.getByRole("status", { name: "Loading account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
  }
  const sound = page.getByRole("button", { name: "Game sound" });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(sound).toHaveAttribute("aria-pressed", "true");
  await sound.click();
  await expect(page.getByTestId("v1-lifetime-xp")).toHaveText("990 XP");
  const progress = page.getByRole("progressbar", { name: "XP to next level" });
  await expect(progress).toHaveAttribute("aria-valuenow", "240");
  const scores = page.getByRole("region", { name: "Player progress" });
  await expect(scores.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "240",
  );
  await expect(scores.locator(".game-event-score")).toContainText("0 XP");
  await expect(page.getByRole("banner")).not.toContainText("Lifetime XP");
  xp = 1000;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const dialog = page.getByRole("dialog", { name: "Level up!" });
  await expect(dialog).toContainText("Pro · Level 5");
  const capture = (screen: string) =>
    page.screenshot({
      path: path.resolve(
        process.env.V1_SCREENSHOT_DIR || "../../outputs/v1-screenshots",
        `${info.project.name}-${screen}.png`,
      ),
      fullPage: true,
    });
  await capture("level-up");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".game-confetti")).toBeHidden();
  await dialog.getByRole("button", { name: "Keep playing" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(progress).toHaveAttribute("aria-valuenow", "0");

  let moved = false;
  await page.route("**/rest/v1/rpc/v1_leaderboard", (route) =>
    route.fulfill({
      json: [
        { id: "gold", name: "ShuttleAce", xp: 120, rank: 1 },
        { id: "silver", name: "NetNinja", xp: 100, rank: 2 },
        { id: "bronze", name: "RallyRider", xp: 80, rank: moved ? 4 : 3 },
        {
          id: f.user.id,
          name: "Your test player",
          xp: moved ? 90 : 60,
          rank: moved ? 3 : 4,
        },
      ].sort((a, b) => a.rank - b.rank),
    }),
  );
  await page.clock.install();
  const nav = page.getByRole("navigation", { name: "Fan arena" });
  const rankingsTab = nav.getByRole("link", { name: "Rankings", exact: true });
  await rankingsTab.click();
  const podium = page.getByRole("list", { name: "Top three" });
  await expect(podium.getByRole("listitem")).toHaveCount(3);
  const pinned = page.getByTestId("v1-standings").locator("tbody tr").first();
  await expect(pinned).toHaveClass(/game-pinned/);
  await expect(pinned).toContainText("#4");
  await expect(pinned).toContainText("Your test player");
  moved = true;
  await page.clock.fastForward(30_500);
  await expect(pinned.getByRole("img", { name: "Up 1 place" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Down 1 place" })).toBeVisible();
  await expect(pinned).toContainText("#3");
  await expect(rankingsTab).toHaveAttribute("aria-current", "page");
  if (info.project.name === "mobile") {
    await expect(nav).toHaveCSS("position", "fixed");
    await expect(rankingsTab).toHaveCSS("min-height", "52px");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await capture("podium");

  const alternate = await f.owner.rpc("v1_admin_save", {
    p_kind: "quiz",
    p_data: {
      tournament_id: f.tournament,
      title: "Second shuttle quiz",
      opens_at: new Date(Date.now() - 3_600_000).toISOString(),
      closes_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  expect(alternate.error).toBeNull();
  sql(`update public.quizzes set published=true where id='${alternate.data}';`);
  await page.getByRole("link", { name: "Quiz", exact: true }).click();
  const picker = page.getByRole("group", { name: "Choose a quiz" });
  const second = picker.getByRole("button", { name: /Second shuttle quiz/ });
  await expect(second).toContainText("OPEN");
  await expect(second).toContainText("Closes in");
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Second shuttle quiz" }),
  ).toBeVisible();
  await capture("quiz-picker");
});
