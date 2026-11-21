import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
const fan = "c0000000-0000-0000-0000-000000000001";
const row = {
  rank: 1,
  username: "RallyFan",
  country: "MT",
  best_level: 3,
  best_hits: 24,
  best_score: 44,
  achieved_on: "2026-11-21",
};
async function setup(page: Page, signedIn = false) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.route("**/api/v1/config", (r) =>
    r.fulfill({
      json: {
        ready: true,
        url: "http://127.0.0.1:54321",
        key: "local-browser-fixture-only",
      },
    }),
  );
  if (signedIn)
    await page.addInitScript(
      ({ fan }) =>
        localStorage.setItem(
          "badmintonxp-v1-auth",
          JSON.stringify({
            access_token: "local-browser-fixture",
            refresh_token: "local-browser-fixture",
            expires_at: 4102444800,
            token_type: "bearer",
            user: {
              id: fan,
              user_metadata: {},
              email: "private@example.test",
              aud: "authenticated",
              role: "authenticated",
            },
          }),
        ),
      { fan },
    );
  await page.route("**/auth/v1/**", (r) => r.fulfill({ json: { id: fan } }));
  let banked = false;
  let resultRow = { ...row };
  const resetsAt = new Date(Date.now() + 86400000).toISOString();
  await page.route("**/rest/v1/rpc/**", async (r) => {
    const name = r.request().url().split("/").pop();
    if (name === "v1_game_finish") {
      banked = true;
      const args = r.request().postDataJSON();
      resultRow = {
        ...row,
        best_level: args.p_level,
        best_hits: args.p_hits,
        best_score: args.p_hits + 10 * (args.p_level - 1),
      };
    }
    const data =
      name === "v1_home"
        ? {
            server_now: new Date().toISOString(),
            profile: signedIn
              ? { id: fan, username: "RallyFan", country: "MT", team_id: null }
              : null,
            teams: [],
            tournament: null,
            quizzes: [],
            matches: [],
            lifetime_xp: banked ? 20 : 0,
            event_xp: 0,
            admin: false,
          }
        : name === "v1_game_start"
          ? { run_id: "d0000000-0000-0000-0000-000000000001", seed: 42 }
          : name === "v1_game_finish"
            ? {
                accepted: true,
                xp_added: 20,
                xp_today: 20,
                xp_cap: 20,
                resets_at: resetsAt,
              }
            : name === "v1_game_status"
              ? {
                  xp_today: banked ? 20 : 0,
                  xp_cap: 20,
                  resets_at: banked ? resetsAt : null,
                }
              : name === "v1_smash_leaderboard"
                ? {
                    rows: signedIn && banked ? [resultRow] : [],
                    me: signedIn && banked ? resultRow : null,
                  }
                : name === "v1_smash_country_board"
                  ? [
                      {
                        country: "MT",
                        best_level: resultRow.best_level,
                        best_score: resultRow.best_score,
                        fans: 1,
                        top_fan: "RallyFan",
                      },
                    ]
                  : name === "v1_tournament_rankings"
                    ? {
                        tournament_id: null,
                        final: false,
                        past: [],
                        boards: { players: [], teams: [], countries: [] },
                      }
                    : null;
    await r.fulfill({ json: data });
  });
  await page.goto("/play/smash-up");
  await expect(
    page.getByRole("heading", { name: "Smash Up", exact: true }),
  ).toBeVisible();
}
async function lose(page: Page, capture?: (name: string) => Promise<unknown>) {
  await page.keyboard.down("ArrowRight");
  if (capture) {
    let dropped = false;
    for (let i = 0; i < 120; i++) {
      await page.clock.runFor(100);
      if (await page.locator(".smash-drop-state").count()) {
        await capture("dropped");
        dropped = true;
        break;
      }
    }
    expect(dropped).toBe(true);
    await page.clock.runFor(1000);
  } else await page.clock.runFor(8000);
  await page.keyboard.up("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Share score", exact: true }),
  ).toBeVisible();
}
async function rally(
  page: Page,
  goal: number,
  capture: (name: string) => Promise<unknown>,
) {
  await expect(page.locator(".smash-hud")).toBeVisible();
  const canvas = page.locator(".smash-court canvas");
  const box = (await canvas.boundingBox())!;
  let mouseX = box.x + box.width / 2;
  await page.mouse.move(mouseX, box.y + box.height / 2);
  await page.mouse.down();
  let lit = false,
    mid = false,
    great = false,
    burst = false,
    levelCard = false,
    wind = false;
  for (let i = 0; i < 2200; i++) {
    const state = await canvas.evaluate((node) => {
      const c = node as HTMLCanvasElement;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      let ox = 0,
        on = 0,
        rx = 0,
        rn = 0;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const j = (y * c.width + x) * 4;
          if (
            y <
              c.height - 40 * Math.min((c.width - 24) / 360, c.height / 580) &&
            d.data[j] > 240 &&
            d.data[j + 1] > 120 &&
            d.data[j + 1] < 155 &&
            d.data[j + 2] < 100
          ) {
            ox += x;
            on++;
          }
          if (
            y >
              c.height - 118 * Math.min((c.width - 24) / 360, c.height / 580) &&
            y <
              c.height - 30 * Math.min((c.width - 24) / 360, c.height / 580) &&
            d.data[j] > 220 &&
            d.data[j + 1] > 35 &&
            d.data[j + 1] < 75 &&
            d.data[j + 2] > 45 &&
            d.data[j + 2] < 90
          ) {
            rx += x;
            rn++;
          }
        }
      return {
        dx: on && rn ? ((ox / on - rx / rn) * c.clientWidth) / c.width : 0,
      };
    });
    mouseX += state.dx;
    await page.mouse.move(mouseX, box.y + box.height / 2);
    const smash = page.getByRole("button", {
      name: /^(SMASH|ARMED)/,
      exact: true,
    });
    if (!(await smash.count()))
      throw new Error(
        "Scripted rally missed: " +
          (await page.locator(".smash-overlay").textContent()),
      );
    if (
      !mid &&
      (await page.locator(".smash-progress span").textContent()) === "3/10"
    ) {
      await capture("mid-rally");
      mid = true;
    }
    if (
      !great &&
      (await page.locator(".smash-progress span").textContent()) === "10/10"
    ) {
      await capture("great-pop");
      great = true;
    }
    if (!burst && (await page.locator(".smash-moment").count())) {
      await capture("smash-burst");
      burst = true;
    }
    if (
      !levelCard &&
      (await page.locator(".smash-level-card").count()) &&
      (await page.locator(".smash-level-card strong").textContent()) ===
        "Level 2"
    ) {
      await expect(page.locator(".smash-countdown")).toHaveCount(0);
      await page.clock.runFor(300);
      await capture("level-2");
      levelCard = true;
    }
    if (await smash.isEnabled()) {
      if (!lit) {
        await capture("smash-lit");
        lit = true;
      }
      await page.keyboard.press("Space");
    }
    const level = await page
      .locator(".smash-hud strong .sr-only")
      .textContent();
    if (
      level === `Level ${goal}` &&
      (goal < 5 ||
        Number(
          (await page.getByLabel("Wind", { exact: true }).textContent())?.match(
            /\d+/,
          )?.[0] ?? 0,
        ) >= 25)
    ) {
      if (goal >= 5 && !wind) {
        await capture("playing-wind");
        wind = true;
      }
      break;
    }
    await page.clock.runFor(150);
  }
  await page.mouse.up();
  expect({ mid, great, burst, levelCard, lit, wind }).toEqual({
    mid: true,
    great: true,
    burst: true,
    levelCard: true,
    lit: true,
    wind: true,
  });
  await expect(page.locator(".smash-hud strong .sr-only")).toHaveText(
    `Level ${goal}`,
  );
}
for (const authenticated of [false, true])
  test(`Smash Up ${authenticated ? "signed-in XP fixture" : "guest sharing, lifecycle and sixth tab"}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(
      info.project.name === "mobile"
        ? { width: 360, height: 800 }
        : { width: 1440, height: 900 },
    );
    const capture = (name: string) =>
      page.screenshot({
        path: path.resolve(
          process.env.V1_SCREENSHOT_DIR || "../../outputs/smash-up-solo",
          `${authenticated ? "fan" : "guest"}-${name}-${page.viewportSize()!.width}x${page.viewportSize()!.height}.png`,
        ),
        animations: "allow",
        // Freeze the CSS slide at its readable middle frame; game time is untouched.
        style:
          ".smash-level-card { animation-delay: -400ms !important; animation-play-state: paused !important; }",
      });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await setup(page, authenticated);
    if (authenticated)
      await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(
      page.getByRole("navigation", { name: "Fan arena" }).getByRole("link"),
    ).toHaveCount(6);
    await expect(
      page.getByRole("link", { name: "Smash Up", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await capture("ready");
    if (!authenticated) {
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.clock.runFor(500);
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expect(
        page.getByRole("heading", { name: "Paused. Tap to resume." }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await lose(page, capture);
      await capture("game-over");
      await expect(
        page
          .getByText("Create a free account to get on the Smash Up leaderboard")
          .first(),
      ).toBeVisible();
      await page.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (data: ShareData) => {
            (window as unknown as { shared: ShareData }).shared = data;
          },
        }),
      );
      await page
        .getByRole("button", { name: "Share score", exact: true })
        .click();
      expect(
        await page.evaluate(
          () => (window as unknown as { shared: ShareData }).shared,
        ),
      ).toEqual({
        title: "Smash Up",
        text: "I smashed my way to level 1 with 0 hits on Smash Up 🏸 Can you beat me?",
        url: "https://badmintonxp.com/play/smash-up",
      });
      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              (window as unknown as { copied: string }).copied = text;
            },
          },
        });
      });
      await page
        .getByRole("button", { name: "Share score", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Copied!", exact: true }),
      ).toBeVisible();
      await capture("copied");
      expect(
        await page.evaluate(
          () => (window as unknown as { copied: string }).copied,
        ),
      ).toContain("https://badmintonxp.com/play/smash-up");
    } else {
      await expect(page.getByText("0/20 XP this window")).toBeVisible();
      await page.getByRole("button", { name: "Play", exact: true }).click();
      const action = page.locator(".smash-action");
      await expect(page.locator(".smash-court .smash-action")).toHaveCount(0);
      await expect(action).toBeDisabled();
      const courtBox = (await page.locator(".smash-court").boundingBox())!,
        barBox = (await action.boundingBox())!;
      expect(barBox.y).toBeGreaterThanOrEqual(courtBox.y + courtBox.height);
      await rally(page, 5, capture);
      await lose(page, capture);
      await expect(
        page.getByText("+20 XP · 20/20 XP this window"),
      ).toBeVisible();
      await expect(page.locator(".game-player")).toContainText("20 XP");
      await capture("xp-result");
      await page.getByRole("tab", { name: "Today", exact: true }).click();
      await page.locator(".smash-board").scrollIntoViewIfNeeded();
      await capture("today");
      await expect(page.locator(".smash-row.is-you")).toContainText("RallyFan");
      await expect(page.locator(".smash-board")).not.toContainText(
        "private@example.test",
      );
      for (const tab of ["All-time", "Countries"]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expect(page.locator(".smash-row").first()).toBeVisible();
        await capture(tab.toLowerCase());
      }
    }
    expect(errors).toEqual([]);
  });

test("Smash Up stays playable without configuration and supports legacy copy", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.route("**/api/v1/config", (r) =>
    r.fulfill({ json: { ready: false } }),
  );
  await page.goto("/play/smash-up");
  await expect(
    page.getByRole("heading", { name: "Smash Up", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Smash Up leaderboard" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await lose(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    });
  });
  await page.getByRole("button", { name: "Share score", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied!", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = (name: string) =>
      name === "copy" &&
      document
        .querySelector("textarea")
        ?.value.includes("https://badmintonxp.com/play/smash-up") === true;
  });
  await page.getByRole("button", { name: "Share score", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied!", exact: true }),
  ).toBeVisible();
});
