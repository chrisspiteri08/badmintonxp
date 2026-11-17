import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import path from "node:path";

test("landing shows the benefits and all registration links", async ({
  page,
  request,
}, info) => {
  const viewport =
    info.project.name === "mobile"
      ? { width: 360, height: 800 }
      : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Pick your country. Beat the world.",
  );
  await expect(page.locator("main")).toContainText(
    "A free badminton quiz and prediction game. Officially launching at the World Tour Finals, 9–13 Dec.",
  );
  const benefits = page.getByRole("region", { name: "Why play BadmintonXP" });
  await expect(page.locator(".launch-hero + .launch-benefits")).toBeVisible();
  await expect(benefits.getByRole("listitem")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "How it plays" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "The World Tour Finals start 9 Dec. Get your spot.",
    }),
  ).toBeVisible();
  await expect(page.locator(".launch-country-race")).toBeVisible();
  for (const [title, copy] of [
    [
      "Play for your country",
      "Every point you score lifts your nation in the live country rankings.",
    ],
    [
      "Call the big match",
      "Predict one featured match a day. Get it right for +20 XP.",
    ],
    [
      "Daily badminton quiz",
      "Quick questions every day of the tournament, easy to hard. +10 XP each.",
    ],
    [
      "Build your team",
      "Start a team, invite friends, and climb together. Your top 10 count.",
    ],
  ]) {
    const card = benefits
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: title }) });
    await expect(card).toContainText(copy);
    await expect(card.locator(".launch-benefit-icon")).toBeVisible();
  }
  await expect(benefits).toContainText(
    "Free to play. Every tournament starts at 0.",
  );
  await expect(page.getByRole("contentinfo")).not.toContainText(
    /prizes|payments/i,
  );
  const register = page.getByRole("link", {
    name: "Register free",
    exact: true,
  });
  await expect(register).toHaveCount(4);
  await expect(register.first()).toHaveClass(/game-button/);
  for (const link of await register.all())
    await expect(link).toHaveAttribute("href", "/play/account?mode=signup");
  expect(
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".launch-benefit"));
      return {
        columns: cards.filter(
          (card) =>
            card.getBoundingClientRect().top ===
            cards[0].getBoundingClientRect().top,
        ).length,
        fits:
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= 2 * innerHeight,
      };
    }),
  ).toEqual({ columns: viewport.width === 360 ? 2 : 4, fits: true });
  await page.screenshot({
    path: path.resolve(
      process.env.LAUNCH_SCREENSHOT_DIR || "../../outputs",
      `${process.env.GAME_FEEL_SCREENSHOTS === "1" ? "landing" : "BadmintonXP-benefits"}-${viewport.width}x${viewport.height}.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });

  for (const route of ["/privacy", "/terms", "/about"]) {
    const response = await request.get(route);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Draft for review");
  }
  const ogImage = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  const image = await request.get(new URL(ogImage!).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  await page
    .getByRole("region", { name: "World Tour Finals registration" })
    .getByRole("link", { name: "Register free" })
    .click();
  await expect(page).toHaveURL(/\/play\/account\?mode=signup$/);
  await expect(page.locator(".v1")).toBeVisible();
});

test("waitlist API validates submissions and ignores the honeypot", async ({
  request,
}) => {
  const headers = {
    "x-forwarded-for": `2001:db8::${randomBytes(2).toString("hex")}:${randomBytes(2).toString("hex")}`,
  };
  for (const data of [
    { email: "bad", consent: true },
    { email: "fan@example.com", consent: false },
  ]) {
    expect(
      (await request.post("/api/waitlist", { data, headers })).status(),
    ).toBe(400);
  }
  const bot = await request.post("/api/waitlist", {
    headers,
    data: { email: "bot@example.com", consent: true, website: "filled" },
  });
  expect(bot.status()).toBe(200);
  expect(await bot.json()).toEqual({ ok: true });
});
