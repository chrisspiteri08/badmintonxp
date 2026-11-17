import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import path from "node:path";
import { fixture, local, password, sql } from "./local";
test.beforeEach(async ({ page }) => {
  // The shared local Supabase test stack predates the fan-team migration.
  for (const [name, data] of [
    ["v1_my_team", null],
    ["v1_admin_fan_teams", []],
  ] as const) {
    await page.route(`**/rest/v1/rpc/${name}`, (route) =>
      route.fulfill({ json: data }),
    );
  }
});
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
  const gameFeel = process.env.GAME_FEEL_SCREENSHOTS === "1";
  if (gameFeel)
    await page.setViewportSize(
      info.project.name === "mobile"
        ? { width: 360, height: 800 }
        : { width: 1440, height: 900 },
    );
  const tag = randomUUID().slice(0, 8);
  const f = await fixture(tag);
  const email = `fan-${tag}@example.test`,
    pass = randomBytes(6).toString("base64url").slice(0, 6),
    username = `fan_${tag}`;
  const capture = (screen: string) =>
    page.screenshot({
      path: path.resolve(
        process.env.V1_SCREENSHOT_DIR || "../../outputs/v1-screenshots",
        gameFeel
          ? `${screen}-${page.viewportSize()!.width}x${page.viewportSize()!.height}.png`
          : `${info.project.name}-${screen}.png`,
      ),
      fullPage: !gameFeel,
      animations: "disabled",
    });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page
    .locator(".launch-hero")
    .getByRole("link", { name: "Register free" })
    .click();
  await page.getByLabel("Player name").fill(username);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Country").selectOption("MY");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("radio", { name: "Join an existing team" }).check();
  await page.getByLabel("Choose a team").selectOption(f.team);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  await expect(
    page.getByRole("heading", {
      name: "You're in for the World Tour Finals 🏸",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("timer", { name: "Time until launch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try the preview · Hong Kong Open" }),
  ).toHaveAttribute("href", "/play");
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
  let sent = false;
  await page.route("**/rest/v1/feedback", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      tournament_id: f.tournament,
      rating: 5,
      comment: "Great preview!",
    });
    sent = true;
    await route.fulfill({ status: 201 });
  });
  await page.goto("/play");
  await expect(page.getByLabel("Preview edition")).toContainText(
    "Help shape the game",
  );
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  const feedback = page.getByRole("dialog", { name: "How’s the preview?" });
  await feedback.getByRole("button", { name: "Send feedback" }).click();
  expect(sent).toBe(false);
  await feedback.getByLabel("Rating").selectOption("5");
  await feedback.getByLabel("Comment (optional)").fill("Great preview!");
  await feedback.getByRole("button", { name: "Send feedback" }).click();
  await expect(feedback.getByRole("status")).toContainText(
    "Thanks for helping",
  );
  expect(sent).toBe(true);
  await feedback.getByRole("button", { name: "Close" }).click();
  await page.goto("/play/admin", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Players’ side." }),
  ).toBeVisible();
  let movedUp = false;
  const rankingsRpc = "**/rest/v1/rpc/v1_tournament_rankings";
  await page.route(rankingsRpc, (route) =>
    route.fulfill({
      json: {
        tournament_id: f.tournament,
        final: false,
        past: [],
        boards: {
          countries: [
            {
              id: "MY",
              name: "MY",
              rank: movedUp ? 8 : 9,
              xp: 20,
              gap: null,
              fans: 1,
            },
          ],
          teams: [
            {
              id: f.team,
              name: f.teamName,
              rank: movedUp ? 2 : 3,
              xp: 20,
              gap: null,
              fans: 1,
            },
          ],
          players: [],
        },
      },
    }),
  );
  await page.goto("/play");
  await expect(
    page.getByRole("heading", { name: `Isolated Cup ${tag}` }),
  ).toBeVisible();
  await expect(page.getByText("You · Your country: #9")).toBeVisible();
  await capture("home");
  if (info.project.name === "mobile") {
    const scroll = page.locator(".arena-scroll");
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const footer = await page.getByRole("contentinfo").boundingBox();
    const tabs = await page
      .getByRole("navigation", { name: "Fan arena" })
      .boundingBox();
    expect(footer!.y + footer!.height).toBeLessThan(tabs!.y);
    await scroll.evaluate((element) => {
      element.scrollTop = 0;
    });
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
  await expect(
    page.getByRole("button", { name: "C 16", exact: true }),
  ).toHaveClass(/game-button/);
  await expect(page.locator(".quiz-panel")).toHaveAttribute(
    "data-panel",
    "quiz",
  );
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
  const nativePrompt = () =>
    page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          document.documentElement.dataset.nativeInstall = "called";
        },
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(event);
    });
  await nativePrompt();
  await expect(
    page.getByRole("complementary", {
      name: "Add BadmintonXP to your home screen",
    }),
  ).toHaveCount(0);
  movedUp = true;
  await page.getByRole("button", { name: "C 16", exact: true }).click();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  await expect(page.getByTestId("v1-quiz-score")).toBeInViewport();
  await expect(page.getByText("🇲🇾 Malaysia moved up to #8!")).toBeVisible();
  await expect(page.getByText(`${f.teamName} moved up to #2!`)).toBeVisible();
  const installCard = page.getByRole("complementary", {
    name: "Add BadmintonXP to your home screen",
  });
  await expect(installCard).toContainText(
    "Add BadmintonXP to your home screen",
  );
  await page.setViewportSize(
    info.project.name === "mobile"
      ? { width: 360, height: 800 }
      : { width: 1440, height: 900 },
  );
  const score = page.getByTestId("v1-quiz-score");
  const toast = page.locator(".rank-toasts");
  const scoreBox = await score.boundingBox();
  const toastBox = await toast.boundingBox();
  const stripBox = await installCard.boundingBox();
  expect(toastBox!.y + toastBox!.height).toBeLessThan(scoreBox!.y);
  expect(stripBox!.y).toBeGreaterThan(scoreBox!.y + scoreBox!.height);
  await expect(
    page.getByRole("heading", { name: "Shuttle IQ", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: path.resolve(
      "../../outputs",
      `BadmintonXP-PWA-${info.project.name === "mobile" ? "360x800" : "1440x900"}.png`,
    ),
    animations: "disabled",
  });
  await expect(toast).toBeHidden({ timeout: 4200 });
  await installCard
    .getByRole("button", { name: "Install BadmintonXP" })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-native-install",
    "called",
  );
  await expect(installCard).toBeHidden();
  await page.unroute(rankingsRpc);
  await page.reload();
  await expect(page.getByTestId("v1-quiz-score")).toHaveText("+20 XP");
  await nativePrompt();
  await expect(installCard).toBeHidden();
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
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  const you = page.locator(".arena-own-rank");
  await expect(you).toHaveText([
    "You · Your country: #1",
    "You · Your team: #1",
    "You: #1",
  ]);

  await page.getByRole("link", { name: "Rankings", exact: true }).click();
  const showRanking = async (name: string) => {
    const tab = page.getByRole("button", { name, exact: true });
    if (info.project.name === "mobile") await tab.click();
    return page.getByRole("region", { name, exact: true });
  };
  await expect(await showRanking("Fans")).toContainText(username);
  await expect(await showRanking("Fans")).toContainText("40 XP");
  await capture("rankings");
  await expect(await showRanking("Teams")).toContainText(f.teamName);
  await expect(await showRanking("Countries")).toContainText("Malaysia");
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
  await expect(await showRanking("Fans")).toContainText(username);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
  const tag = randomUUID().slice(0, 8),
    f = await fixture(tag);
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();
  await page.route("**/rest/v1/feedback?*", (route) =>
    route.fulfill({
      json: [
        {
          id: "feedback-test",
          user_id: "fan-test",
          tournament_id: "event-test",
          rating: 4,
          comment: "More doubles quizzes, please.",
          created_at: "2026-11-16T12:00:00Z",
        },
      ],
    }),
  );
  await page.goto("/play/admin", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Preview feedback" }),
  ).toBeVisible();
  await expect(page.getByText("More doubles quizzes, please.")).toBeVisible();
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
    animations: "disabled",
  });
});

test("server timeout advances a real unanswered question and saves the final score", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await page.clock.install();
  let started = false;
  let heldRefresh = false;
  let timeoutResumes = 0;
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await page.route("**/rest/v1/rpc/v1_quiz", async (route) => {
    const action = route.request().postDataJSON().p_action;
    if (action === "start") started = true;
    if (action === "resume" && started) timeoutResumes++;
    await route.continue();
  });
  await page.route("**/rest/v1/rpc/v1_home", async (route) => {
    if (!started || heldRefresh) {
      await route.continue();
      return;
    }
    heldRefresh = true;
    await refreshGate;
    const response = await route.fetch();
    const home = await response.json();
    // Keep the held refresh in sync with the intentionally advanced browser clock.
    home.server_now = await page.evaluate(() => new Date().toISOString());
    await route.fulfill({ response, json: home });
  });
  await page.goto("/play/quiz");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByTestId("v1-question")).toContainText("Round 1");
  await expect.poll(() => heldRefresh).toBe(true);
  try {
    await page.clock.fastForward(11_000);
    await expect(page.getByRole("timer")).toHaveClass(/urgent/);
    await page.clock.fastForward(5_000);
    await expect(
      page.getByRole("timer", { name: "0 seconds remaining" }),
    ).toBeVisible();
    expect(timeoutResumes).toBe(0);

    // The browser clock cannot advance PostgreSQL's clock.
    const { data, error } = await f.admin
      .from("attempts")
      .update({ deadline: new Date(Date.now() - 1000).toISOString() })
      .eq("quiz_id", f.quiz)
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  } finally {
    releaseRefresh();
  }
  await expect
    .poll(async () => {
      await page.clock.runFor(300);
      return timeoutResumes;
    })
    .toBeGreaterThan(0);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await page.goto("/play/admin", { waitUntil: "domcontentloaded" });
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
    animations: "disabled",
  });
});

test("game HUD waits for the account, celebrates levels, and switches quiz cards", async ({
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

  sql(`
    insert into public.quizzes (tournament_id, title, opens_at, closes_at, published)
    select tournament_id, 'Second shuttle quiz', opens_at, closes_at, true
    from public.quizzes where id = '${f.quiz}';
  `);
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

test("tournament hero checks the file and alt text, compresses uploads, and supports replacing and removing", async ({
  page,
}) => {
  const f = await fixture(randomUUID().slice(0, 8));
  const { data } = await f.owner.rpc("v1_home");
  const event = data.tournament;
  const pattern = /\/storage\/v1\/object\/(?:public\/)?tournament-heroes\//;
  const saved: Record<string, string> = {
    hero_image_url: "",
    hero_image_alt: "",
    city: "",
  };
  const uploaded: { path: string; width: number; height: number }[] = [];
  const source = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1200;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#142d54";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.route(pattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET") {
      await route.fulfill({
        contentType: "image/png",
        body: Buffer.from(source, "base64"),
      });
      return;
    }
    const path = url.pathname.split("/tournament-heroes/")[1];
    const body = request.postDataBuffer()!;
    const start = body.indexOf("RIFF");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(body.toString("ascii", start + 8, start + 12)).toBe("WEBP");
    const length = body.readUInt32LE(start + 4) + 8;
    const dimensions = await page.evaluate(
      async (bytes) => {
        const image = await createImageBitmap(
          new Blob([Uint8Array.from(bytes)], { type: "image/webp" }),
        );
        const { width, height } = image;
        image.close();
        return { width, height };
      },
      [...body.subarray(start, start + length)],
    );
    uploaded.push({ path, ...dimensions });
    await route.fulfill({
      json: { Key: `tournament-heroes/${path}`, Id: path },
    });
  });
  await page.route("**/rest/v1/rpc/v1_admin_snapshot", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    snapshot.tournaments = snapshot.tournaments.map(
      (tournament: { id: string }) =>
        tournament.id === event.id ? { ...tournament, ...saved } : tournament,
    );
    await route.fulfill({ response, json: snapshot });
  });
  await page.route("**/rest/v1/rpc/v1_admin_save", async (route) => {
    const { p_kind, p_data } = route.request().postDataJSON();
    expect(p_kind).toBe("tournament_hero");
    expect(p_data.tournament_id).toBe(event.id);
    Object.assign(saved, p_data);
    await route.fulfill({ json: event.id });
  });
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();
  await page.goto("/play/admin", { waitUntil: "domcontentloaded" });
  await page.getByText("Tournament hero", { exact: true }).click();
  const form = page.getByRole("form", { name: `Hero for ${event.name}` });
  const picker = form.locator('input[type="file"]');
  await picker.setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(form.getByRole("alert")).toContainText("up to 5 MB");
  const file = {
    name: "court.png",
    mimeType: "image/png",
    buffer: Buffer.from(source, "base64"),
  };
  await picker.setInputFiles(file);
  await expect(
    form.getByRole("img", { name: "Tournament hero preview" }),
  ).toHaveAttribute("src", /^blob:/);
  const alt = form.getByLabel("Hero image alt text");
  await expect(alt).toHaveJSProperty("required", true);
  await form.getByRole("button", { name: "Save hero" }).click();
  expect(uploaded).toHaveLength(0);
  await alt.fill("Blue badminton court");
  await form.getByRole("button", { name: "Save hero" }).click();
  await expect(form.getByLabel("Hero image URL")).toHaveValue(
    /\/object\/public\/tournament-heroes\/.*\.webp$/,
  );
  expect(uploaded[0]).toMatchObject({ width: 1920, height: 960 });
  expect(saved.hero_image_url).toContain(uploaded[0].path);
  expect(saved.hero_image_alt).toBe("Blue badminton court");
  await picker.setInputFiles(file);
  await expect(
    form.getByRole("img", { name: "Tournament hero preview" }),
  ).toHaveAttribute("src", /^blob:/);
  await form.getByRole("button", { name: "Save hero" }).click();
  await expect
    .poll(() => uploaded[1] && saved.hero_image_url.includes(uploaded[1].path))
    .toBe(true);
  expect(uploaded[1].path).not.toBe(uploaded[0].path);
  await form.getByRole("button", { name: "Remove hero image" }).click();
  await form.getByRole("button", { name: "Save hero" }).click();
  await expect.poll(() => saved.hero_image_url).toBe("");
  await expect(
    form.getByRole("img", { name: "Tournament hero preview" }),
  ).toHaveCount(0);
  await form
    .getByLabel("Hero image URL")
    .fill("https://example.test/manual-hero.webp");
  await alt.fill("Manual tournament photo");
  await form.getByRole("button", { name: "Save hero" }).click();
  await expect
    .poll(() => saved.hero_image_url)
    .toBe("https://example.test/manual-hero.webp");
});

test("signed-in fans enter the arena directly and keep pending team invites", async ({
  page,
}) => {
  const { admin } = local();
  const email = `direct-arena-${randomUUID()}@example.test`;
  const pass = password();
  const { error } = await admin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  expect(error).toBeNull();
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You’re in." })).toBeVisible();

  let releaseConfig!: () => void;
  const configGate = new Promise<void>((resolve) => {
    releaseConfig = resolve;
  });
  await page.route("**/api/v1/config", async (route) => {
    await configGate;
    await route.continue();
  });
  await page.goto("/");
  try {
    await expect(
      page.getByRole("status", { name: "Checking session" }),
    ).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: "Register free", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "ENTER THE ARENA", exact: true }),
    ).toHaveCount(0);
  } finally {
    releaseConfig();
  }
  const enter = page.getByRole("link", {
    name: "ENTER THE ARENA",
    exact: true,
  });
  await expect(enter).toHaveCount(4);
  for (const link of await enter.all())
    await expect(link).toHaveAttribute("href", "/play");
  await expect(
    page.getByRole("link", { name: "Register free", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "ENTER THE ARENA" })
    .click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(
    page.getByRole("navigation", { name: "Fan arena" }),
  ).toBeVisible();
  for (const mode of ["signup", "signin"]) {
    await page.goto(`/play/account?mode=${mode}`);
    await expect(page).toHaveURL(/\/play$/);
    await page.goto(`/play/account?mode=${mode}&invite=c0ffeefeed01`);
    await expect(page).toHaveURL(/\/join\/c0ffeefeed01$/);
  }
});
