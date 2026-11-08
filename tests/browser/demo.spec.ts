import { test, expect } from "@playwright/test";
import path from "node:path";
const output = path.resolve(
  process.env.DEMO_SCREENSHOT_DIR || "../../outputs/screenshots",
);
const key = "badmintonxp:guest:v1";
test("guest journey, persisted clocks, actual ledger, settlement and matching rankings", async ({
  page,
}, testInfo) => {
  const network: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:3100/") &&
      !r.url().startsWith("data:")
    )
      network.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("/demo");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
  const capture = async (name: string) => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(output, `${testInfo.project.name}-${name}.png`),
      fullPage: true,
    });
  };
  await capture("home");
  const originalTop = await page.getByTestId("home-top-three").innerText();
  expect(originalTop).toContain("Net Nomad");
  await expect(page.getByTestId("home-own-rank")).toContainText("#4");
  await page.getByRole("link", { name: /PLAY QUIZ/ }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByTestId("quiz-question")).toContainText("feathers");
  await capture("quiz");
  const deadline = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).attempt.deadline,
    key,
  );
  await page.clock.runFor(4000);
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/demo");
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
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).attempt.answers.length,
      key,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "A One point", exact: true }).click();
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
  await page
    .getByRole("button", { name: "Close entries / advance demo time" })
    .click();
  await page.getByRole("button", { name: "Settle fictional result" }).click();
  await expect(page.getByTestId("prediction-status")).toContainText(
    "Simulated-settled: Ember wins",
  );
  await expect(page.getByTestId("lifetime-xp")).toHaveText("170 XP");
  await capture("settlement");
  await page.reload();
  await expect(page.getByTestId("lifetime-xp")).toHaveText("170 XP");
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
