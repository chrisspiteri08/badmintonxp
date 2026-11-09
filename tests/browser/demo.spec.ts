import { test, expect } from "@playwright/test";
import path from "node:path";
const output = path.resolve(
  process.env.DEMO_SCREENSHOT_DIR || "../../outputs/screenshots",
);
const key = "badmintonxp:guest:v1";
const origin = process.env.DEMO_BASE_URL || "http://127.0.0.1:3100";
test("guest journey, persisted clocks, actual ledger, settlement and matching rankings", async ({
  page,
}, testInfo) => {
  const network: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(`${origin}/`) && !r.url().startsWith("data:"))
      network.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("/demo");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
  const capture = async (name: string) => {
    // Capture complete artwork, including images initially below the fold.
    await page.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map(async (image) => {
          if (image instanceof HTMLImageElement) {
            image.loading = "eager";
            await image.decode();
          }
        }),
      );
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(output, `${testInfo.project.name}-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  };
  await expect(
    page.getByRole("progressbar", { name: "Level 1 progress" }),
  ).toHaveAttribute("aria-valuenow", "140");
  await expect(page.getByTestId("team-event-rank")).toContainText("#1");
  await capture("home");
  const originalTop = await page.getByTestId("home-top-three").innerText();
  expect(originalTop).toContain("Net Nomad");
  await expect(page.getByTestId("home-own-rank")).toContainText("#4");
  await page.getByRole("link", { name: /PLAY QUIZ/ }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByTestId("quiz-question")).toContainText("feathers");
  await expect(page.locator(".countdown-arc")).toBeVisible();
  const answerBox = await page
    .getByRole("button", { name: "C 16", exact: true })
    .boundingBox();
  expect(answerBox!.height).toBeGreaterThanOrEqual(88);
  expect(answerBox!.y + answerBox!.height).toBeLessThanOrEqual(
    testInfo.project.use.viewport!.height,
  );
  await capture("quiz");
  const deadline = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).attempt.deadline,
    key,
  );
  await page.clock.runFor(4000);
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/demo`);
  await page.reload();
  await page.getByRole("link", { name: /RESUME QUIZ/ }).click();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).attempt.deadline,
      key,
    ),
  ).toBe(deadline);
  // Two DOM clicks in one task exercise the action guard before React rerenders.
  await page
    .getByRole("button", { name: "C 16", exact: true })
    .evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
  await expect(
    page.getByRole("heading", { name: "Clean winner." }),
  ).toBeVisible();
  await capture("quiz-correct");
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).attempt.answers.length,
      key,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "A One point", exact: true }).click();
  await expect(page.locator(".answer-reveal.is-wrong")).toBeVisible();
  await capture("quiz-wrong");
  await page.getByRole("button", { name: "Next question" }).click();
  await page.clock.runFor(16000);
  await expect(page.getByTestId("quiz-score")).toHaveText("+10 XP");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("150 XP");
  await page.reload();
  await expect(page.getByTestId("quiz-score")).toHaveText("+10 XP");
  await expect(page.getByRole("button", { name: "Start quiz" })).toHaveCount(0);
  await page.getByRole("link", { name: "Make your match call" }).click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /01 Ember/ }).click();
  await expect(page.getByTestId("prediction-status")).toContainText("Pending");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("150 XP");
  await expect(page.getByRole("button", { name: /02 Kite/ })).toBeDisabled();
  await page.getByText("Demo: settle result", { exact: true }).click();
  await page
    .getByRole("button", { name: "Close entries / advance demo time" })
    .click();
  await page.getByRole("button", { name: "Settle fictional result" }).click();
  await expect(page.getByTestId("prediction-status")).toContainText(
    "Ember wins! You called it. +20 XP",
  );
  await expect(page.getByTestId("lifetime-xp")).toHaveText("170 XP");
  await page.getByText("Demo: settle result", { exact: true }).click();
  await capture("settlement");
  await page.reload();
  await expect(page.getByTestId("lifetime-xp")).toHaveText("170 XP");
  await page.getByText("Demo: settle result", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Settle fictional result" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Rankings", exact: true }).click();
  await expect(page.getByTestId("standings-own-rank")).toHaveText("#1");
  await expect(page.getByTestId("standings-own-xp")).toHaveText("70 XP");
  await capture("standings");
  await page.getByRole("button", { name: "Season", exact: true }).click();
  await expect(page.getByTestId("standings-own-xp")).toHaveText("170 XP");
  await page.getByRole("button", { name: "Teams", exact: true }).click();
  await expect(page.getByTestId("standings-own-xp")).toHaveText("255 XP");
  await page.getByRole("button", { name: "Countries", exact: true }).click();
  await expect(page.getByTestId("standings-own-xp")).toHaveText("255 XP");
  await page.getByRole("button", { name: "Current event" }).click();
  await expect(page.getByTestId("standings-own-xp")).toHaveText("115 XP");
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page.getByTestId("home-own-rank")).toContainText("#1");
  await expect(page.getByTestId("home-own-rank")).toContainText("70 XP");
  await expect(page.getByTestId("home-top-three")).toContainText(
    "Rally Rookie",
  );
  expect(
    network,
    "No live auth, DB, fonts, analytics or other external requests",
  ).toEqual([]);
  expect(errors, "No browser exceptions").toEqual([]);
  // Explicit reset alone enables replay.
  await page
    .getByRole("button", { name: "Full demo reset", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm full reset", exact: true })
    .click();
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
});

test("reload after unanswered absence catches up; late entry and direct-route replay blocked", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/demo/quiz");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByTestId("quiz-timer")).toHaveText("15s");
  await page.goto("/demo/progress");
  await page.clock.runFor(47000);
  await page.goto("/demo/quiz");
  await expect(page.getByTestId("quiz-score")).toHaveText("+0 XP");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
  await page.goto("/demo/prediction");
  await page.getByText("Demo: settle result", { exact: true }).click();
  await page
    .getByRole("button", { name: "Close entries / advance demo time" })
    .click();
  await expect(page.getByRole("button", { name: /01 Ember/ })).toBeDisabled();
  await page.getByRole("button", { name: "Settle fictional result" }).click();
  await expect(page.getByTestId("prediction-status")).toContainText(
    "No entry · 0 XP",
  );
});

test("keyboard final answer includes final XP; reduced motion and corrupt-store reset", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/demo/quiz");
  await page.getByRole("button", { name: "Start quiz" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("quiz-timer")).toHaveText("15s");
  await page.clock.runFor(31000);
  await expect(page.getByTestId("quiz-question")).toContainText("softly");
  await page.getByRole("button", { name: "C Net shot", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("quiz-score")).toHaveText("+10 XP");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("150 XP");
  await expect(page.locator(".xp-pop")).toHaveCSS("animation-name", "none");
  await page.reload();
  await expect(page.getByTestId("lifetime-xp")).toHaveText("150 XP");
  await page.evaluate((k) => localStorage.setItem(k, '{"version":99}'), key);
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be read or saved" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Full demo reset", exact: true })
    .click();
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
});

test("prediction countdown and losing copy match the fixed simulated winner", async ({
  page,
}, testInfo) => {
  await page.clock.install();
  await page.goto("/demo/prediction");
  await expect(page.getByTestId("prediction-countdown")).toContainText(
    "Closes in",
  );
  await expect(page.getByTestId("prediction-countdown")).not.toContainText(
    "UTC",
  );
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /02 Kite/ }).click();
  await expect(page.getByRole("button", { name: /01 Ember/ })).toContainText(
    "Not picked",
  );
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
  await page.getByText("Demo: settle result", { exact: true }).click();
  await page
    .getByRole("button", { name: "Close entries / advance demo time" })
    .click();
  await expect(page.getByTestId("prediction-countdown")).toHaveText(
    "Entries closed",
  );
  await page.getByRole("button", { name: "Settle fictional result" }).click();
  await expect(page.getByTestId("prediction-status")).toHaveText(
    "Ember wins. Better luck next time.",
  );
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
  await page.getByText("Demo: settle result", { exact: true }).click();
  await page.locator("img").evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (image) => {
        if (image instanceof HTMLImageElement) {
          image.loading = "eager";
          await image.decode();
        }
      }),
    );
  });
  await page.screenshot({
    path: path.join(output, `${testInfo.project.name}-prediction-wrong.png`),
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(page.getByTestId("prediction-status")).toHaveText(
    "Ember wins. Better luck next time.",
  );
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
});

test("legacy login fails safely without backend configuration and exposes no admin shortcut", async ({
  page,
}) => {
  const external: string[] = [],
    errors: string[] = [];
  await page.route("**/*", (route) => {
    if (!route.request().url().startsWith(`${origin}/`)) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await expect(
    page.getByText("Application Configuration Error", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Login as Admin", exact: true }),
  ).toHaveCount(0);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("home temporarily redirects to the guest demo and serves its artwork", async ({
  page,
  request,
}) => {
  const response = await request.get(origin + "/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/demo");
  await page.goto("/");
  await expect(page).toHaveURL(origin + "/demo");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
  await expect(
    page.getByRole("heading", { name: "BIRMINGHAM DEMO CUP" }),
  ).toBeVisible();
  const art = await request.get(
    origin + "/demo/badmintonxp-arena-unbranded.jpg",
  );
  expect(art.status()).toBe(200);
  expect(art.headers()["content-type"]).toContain("image/jpeg");
});
