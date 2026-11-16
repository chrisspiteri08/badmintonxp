import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import path from "node:path";

test("landing fits one screen and sends fans to registration", async ({
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
  await expect(page.locator("footer")).toContainText(
    "Free · No prizes · Independent fan game",
  );
  await expect(page.locator("main form, main section")).toHaveCount(0);
  await expect(page.locator("main a")).toHaveCount(1);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.resolve(
      process.env.LAUNCH_SCREENSHOT_DIR || "../../outputs",
      `BadmintonXP-registration-${viewport.width}x${viewport.height}.png`,
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
  await page.getByRole("link", { name: "Register free" }).click();
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
