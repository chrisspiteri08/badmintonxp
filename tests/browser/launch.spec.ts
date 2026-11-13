import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import path from "node:path";

test("launch page renders, validates consent and email, and links to the arena and draft pages", async ({
  page,
  request,
}, info) => {
  const viewport =
    info.project.name === "mobile"
      ? { width: 360, height: 800 }
      : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(new Date("2026-11-13T12:00:00Z"));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Predict\. Quiz\.\s*Earn XP for your country\./,
  );
  await expect(
    page.getByRole("timer", { name: "Time until launch" }),
  ).toContainText("25");
  await expect(page.locator(".launch-phone .answer-grid")).toContainText("16");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.resolve(
      process.env.LAUNCH_SCREENSHOT_DIR || "../../outputs",
      `BadmintonXP-launch-v2-${viewport.width}x${viewport.height}.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });

  await expect(page.locator('a[href^="/play"]')).toHaveCount(0);
  const preview = page.locator(".launch-phone");
  await preview.getByRole("button", { name: "C 16" }).click();
  await expect(preview.getByRole("status")).toContainText(
    "Clean winner · +10 XP",
  );
  await expect(preview.getByRole("link")).toHaveAttribute("href", "#waitlist");
  await page.getByRole("button", { name: "Teams", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Example teams podium" }),
  ).toContainText("Neon Shuttles");
  await page.goto("/");
  await preview.getByRole("button", { name: "A 12" }).click();
  await expect(preview.getByRole("status")).toContainText(
    "Not this rally · 0 XP",
  );

  let posted = false;
  await page.route("**/api/waitlist", (route) => {
    posted = true;
    expect(route.request().postDataJSON()).toEqual({
      email: "fan@example.com",
      consent: true,
      website: "",
    });
    return route.fulfill({ json: { ok: true } });
  });
  const email = page.getByLabel("Email address");
  const consent = page.getByRole("checkbox");
  const submit = page.getByRole("button", { name: "Notify me" });
  await email.fill("invalid");
  await consent.check();
  await submit.click();
  expect(
    await email.evaluate(
      (element: HTMLInputElement) => element.validity.typeMismatch,
    ),
  ).toBe(true);
  await email.fill("fan@example.com");
  await consent.uncheck();
  await submit.click();
  expect(
    await consent.evaluate(
      (element: HTMLInputElement) => element.validity.valueMissing,
    ),
  ).toBe(true);
  expect(posted).toBe(false);
  await consent.check();
  await submit.click();
  await expect(page.locator("#waitlist").getByRole("status")).toHaveText(
    "You're in! 🏸 We'll email you before the first serve in Hangzhou. Warm up with us on X, Instagram and Facebook: @badmintonxpgame",
  );

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
  await page.goto("/play");
  await expect(page).toHaveURL(/\/play$/);
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
