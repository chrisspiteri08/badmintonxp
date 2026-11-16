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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
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
  await page.getByRole("link", { name: "Arena", exact: true }).click();
  await expect(page.getByRole("link", { name: /QUIZ RESULTS/ })).toContainText(
    "Scored 10 XP",
  );
  await expect(
    page.getByRole("link", { name: /QUIZ RESULTS/ }),
  ).not.toContainText("up to 30 XP");
  await page.getByRole("link", { name: /QUIZ RESULTS/ }).click();
  await expect(page).toHaveURL(`${origin}/demo/quiz`);
  await expect(page.getByTestId("quiz-score")).toHaveText("+10 XP");
  await page.reload();
  await expect(page.getByTestId("quiz-score")).toHaveText("+10 XP");
  await expect(page.getByRole("button", { name: "Start quiz" })).toHaveCount(0);
  await page.getByRole("link", { name: "Make your match call" }).click();
  page.on("dialog", () => {
    throw new Error("Unexpected browser dialog");
  });
  await page.getByRole("button", { name: /01 Ember/ }).click();
  await page.getByRole("button", { name: "Lock Ember", exact: true }).click();
  await expect(page.getByTestId("prediction-status")).toContainText("Pending");
  await expect(page.getByTestId("lifetime-xp")).toHaveText("150 XP");
  await expect(page.getByRole("button", { name: /02 Kite/ })).toBeDisabled();
  await expect(page.locator("details.simulation")).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Fast-forward to match end" }).click();
  await page.getByRole("button", { name: "Reveal winner" }).click();
  await expect(page.getByTestId("prediction-status")).toContainText(
    "Ember wins! You called it. +20 XP",
  );
  await expect(page.getByTestId("lifetime-xp")).toHaveText("170 XP");
  await page.getByText("Demo: settle result", { exact: true }).click();
  await capture("settlement");
  await page.reload();
  await expect(page.getByTestId("lifetime-xp")).toHaveText("170 XP");
  await expect(page.locator("details.simulation")).toHaveAttribute("open", "");
  await expect(
    page.getByRole("button", { name: "Reveal winner" }),
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
  await page.getByRole("button", { name: "Fast-forward to match end" }).click();
  await expect(page.getByRole("button", { name: /01 Ember/ })).toBeDisabled();
  await page.getByRole("button", { name: "Reveal winner" }).click();
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
  page.on("dialog", () => {
    throw new Error("Unexpected browser dialog");
  });
  await page.getByRole("button", { name: /02 Kite/ }).click();
  await page.getByRole("button", { name: "Lock Kite", exact: true }).click();
  await expect(page.getByRole("button", { name: /01 Ember/ })).toContainText(
    "Not picked",
  );
  await expect(page.getByTestId("lifetime-xp")).toHaveText("140 XP");
  await expect(page.locator("details.simulation")).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Fast-forward to match end" }).click();
  await expect(page.getByTestId("prediction-countdown")).toHaveText(
    "Entries closed",
  );
  await page.getByRole("button", { name: "Reveal winner" }).click();
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

test("old account routes redirect safely and visitors never see setup details", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/config", (route) =>
    route.fulfill({ json: { ready: false } }),
  );
  for (const [oldPath, newPath] of [
    ["/login", "/play/account"],
    ["/signup", "/play/account"],
    ["/leaderboards", "/play/standings"],
  ]) {
    const response = await request.get(origin + oldPath + "?from=old-link", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(newPath + "?from=old-link");
    await page.goto(oldPath);
    await expect(page).toHaveURL(origin + newPath);
    await expect(
      page.getByRole("heading", { name: "We’ll be back shortly." }),
    ).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(
      /Application Configuration Error|How to fix|Error details|NEXT_PUBLIC|\.env|Supabase|server|database/i,
    );
  }
  expect(errors).toEqual([]);
});

test("the arena, guest demo and artwork stay available", async ({
  page,
  request,
}) => {
  await page.goto("/play");
  await expect(page.locator(".v1")).toBeVisible();
  await page.goto("/demo");
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

test("prediction confirmation cancels safely and locked controls reopen after reload", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.dismiss();
  });
  await page.goto("/demo");
  await expect(page.locator(".xp-chip small")).toHaveText("Lifetime XP");
  await page.getByRole("link", { name: "Predict", exact: true }).click();
  await expect(page.locator("details.simulation")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.getByRole("button", { name: /01 Ember/ }).click();
  await expect(
    page.getByRole("group", { name: "Confirm prediction" }),
  ).toBeVisible();
  await expect(page.getByTestId("prediction-status")).toHaveText(
    "Choose an athlete to lock your pick.",
  );
  await page.getByRole("button", { name: "Keep choosing" }).click();
  await expect(
    page.getByRole("group", { name: "Confirm prediction" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /02 Kite/ }).click();
  await page.getByRole("button", { name: "Lock Kite", exact: true }).click();
  await expect(page.getByTestId("prediction-status")).toContainText(
    "Your Kite entry is locked",
  );
  await expect(page.locator("details.simulation")).toHaveAttribute("open", "");
  await page.getByText("Demo: settle result", { exact: true }).click();
  await expect(page.locator("details.simulation")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fast-forward to match end" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /01 Ember/ })).toBeDisabled();
  expect(dialogs).toEqual([]);
});

test("www redirects to canonical apex and preserves password-reset query parameters", async ({
  request,
}) => {
  for (const pathname of [
    "/demo",
    "/play/account?code=review-code",
    "/play/reset?code=review-code",
  ]) {
    const response = await request.get(origin + pathname, {
      headers: { host: "www.badmintonxp.com" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(
      "https://badmintonxp.com" + pathname,
    );
  }
});

test("standings and health stay available without an active event", async ({
  page,
  request,
}) => {
  await page.route("**/rest/v1/rpc/v1_home", (route) =>
    route.fulfill({
      json: {
        server_now: new Date().toISOString(),
        profile: null,
        admin: false,
        teams: [],
        tournament: null,
        quizzes: [],
        matches: [],
        lifetime_xp: 0,
        event_xp: 0,
      },
    }),
  );
  await page.route("**/rest/v1/rpc/v1_tournament_rankings", (route) =>
    route.fulfill({
      json: {
        tournament_id: null,
        final: false,
        past: [],
        boards: { countries: [], teams: [], players: [] },
      },
    }),
  );
  await page.goto("/leaderboards");
  await expect(page).toHaveURL(origin + "/play/standings");
  await expect(page.getByText("The first event is on its way.")).toBeVisible();
  const response = await request.get(origin + "/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ databaseConnected: true });
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("tournament rankings show countries first, the gap and full standings", async ({
  page,
}, info) => {
  const viewport =
    info.project.name === "mobile"
      ? { width: 360, height: 800 }
      : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.route("**/rest/v1/rpc/v1_home", (route) =>
    route.fulfill({
      json: {
        server_now: "2026-11-14T12:00:00Z",
        profile: null,
        admin: false,
        teams: [],
        tournament: {
          id: "event",
          name: "Tour Finals Test Cup",
          starts_at: "2026-11-12T00:00:00Z",
          ends_at: "2026-11-18T00:00:00Z",
        },
        quizzes: [],
        matches: [],
        lifetime_xp: 0,
        event_xp: 0,
      },
    }),
  );
  let finished = false;
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/rpc/v1_tournament_rankings", async (route) => {
    await response;
    const row = (
      id: string,
      name: string,
      rank: number,
      xp: number,
      gap: number | null,
      fans = 1,
    ) => ({ id, name, rank, xp, gap, fans });
    await route.fulfill({
      json: {
        tournament_id: "event",
        final: finished,
        past: [],
        boards: {
          countries: [
            row("ID", "ID", 1, 240, null, 23),
            row("MY", "MY", 2, 200, 40, 15),
            row("JP", "JP", 3, 180, 20, 12),
            row("DK", "DK", 4, 150, 30, 9),
            row("TH", "TH", 5, 140, 10, 8),
            row("SG", "SG", 6, 120, 20, 4),
          ],
          teams: finished
            ? []
            : [row("neon", "Neon Shuttles", 1, 200, null, 12)],
          players: [
            row("fan", "ShuttleAce", 1, 60, null),
            ...(finished ? [row("joint", "CourtAce", 1, 60, 0)] : []),
          ],
        },
      },
    });
  });
  await page.goto("/play/standings");
  try {
    await expect(
      page.getByRole("status", { name: "Loading rankings" }),
    ).toBeVisible();
    await expect(
      page.getByText("No scores yet. Be the first to rally."),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Tour Finals Test Cup" }),
  ).toBeVisible();
  await expect(page.getByText("Day 3 of 6")).toBeVisible();
  const countries = page.getByRole("region", { name: "Countries" });
  await expect(countries).toContainText("40 XP behind");
  await expect(countries).toContainText("23 fans");
  await expect(countries.getByText("Singapore")).toBeHidden();
  await expect(page.getByRole("button", { name: "Season" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.resolve(
      "../../outputs",
      `BadmintonXP-tournament-rankings-${viewport.width}x${viewport.height}.png`,
    ),
    fullPage: true,
  });
  await countries.getByText("View full countries standings").click();
  await expect(countries.getByText(/Singapore/)).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Teams", exact: true }).click();
  await expect(page.getByRole("region", { name: "Teams" })).toContainText(
    "Neon Shuttles",
  );

  finished = true;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Champions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Joint #1 Fan champions.*ShuttleAce.*CourtAce/),
  ).toBeVisible();
  await expect(page.getByText("No scorer")).toHaveCount(0);
});

test.describe("arena in a non-UTC timezone", () => {
  test.use({ timezoneId: "Asia/Singapore" });
  test("the arena shows tournament art, rankings and challenges in availability order", async ({
    page,
  }, info) => {
    const viewport =
      info.project.name === "mobile"
        ? { width: 360, height: 800 }
        : { width: 1440, height: 900 };
    await page.setViewportSize(viewport);
    const row = (id: string, name: string, rank: number, xp: number) => ({
      id,
      name,
      xp,
      rank,
      gap: null,
      fans: 5,
    });
    const home = {
      server_now: "2026-11-19T10:00:00Z",
      profile: null,
      admin: false,
      teams: [],
      lifetime_xp: 0,
      event_xp: 0,
      tournament: {
        id: "event",
        name: "Hong Kong Open 2026",
        city: "Hong Kong",
        starts_at: "2026-11-17T00:00:00Z",
        ends_at: "2026-11-22T23:59:59Z",
        hero_image_url: "/demo/badmintonxp-arena-unbranded.jpg",
        hero_image_alt: "Players on the Hong Kong tournament court",
      },
      quizzes: [
        {
          id: "done",
          title: "Day 2 quiz",
          closes_at: "2026-11-18T15:00:00Z",
          opens_at: "2026-11-18T00:00:00Z",
          attempt: { complete: true, score: 40 },
        },
        {
          id: "next",
          title: "Day 4 quiz",
          closes_at: "2026-11-20T15:00:00Z",
          opens_at: "2026-11-20T00:00:00Z",
          attempt: null,
        },
        {
          id: "open",
          title: "Day 3 quiz",
          closes_at: "2026-11-19T15:00:00Z",
          opens_at: "2026-11-19T00:00:00Z",
          attempt: null,
        },
      ],
      matches: [
        {
          id: "call",
          athlete_a: "Aster",
          athlete_b: "Blaze",
          closes_at: "2026-11-19T13:00:00Z",
          winner: null,
          entry: null,
        },
        {
          id: "next-call",
          athlete_a: "Ember",
          athlete_b: "Kite",
          opens_at: "2026-11-20T00:00:00Z",
          closes_at: "2026-11-20T13:00:00Z",
          winner: null,
          entry: null,
        },
        {
          id: "miss",
          athlete_a: "Orchid",
          athlete_b: "Maple",
          closes_at: "2026-11-18T10:00:00Z",
          winner: "Maple",
          entry: null,
        },
      ],
    };
    await page.route("**/rest/v1/rpc/v1_home", (route) =>
      route.fulfill({ json: home }),
    );
    let finalRankings = false;
    await page.route("**/rest/v1/rpc/v1_tournament_rankings", (route) =>
      route.fulfill({
        json: {
          tournament_id: "event",
          final: finalRankings,
          past: [],
          boards: {
            countries: [
              row("MY", "MY", 1, 240),
              row("ID", "ID", 2, 210),
              row("JP", "JP", 3, 160),
            ],
            teams: [
              row("team1", "Neon Shuttles", 1, 230),
              row("team2", "Court Crew", 2, 180),
              row("team3", "Net Flyers", 3, 150),
            ],
            players: [
              row("fan1", "ShuttleAce", 1, 80),
              row("fan2", "NetNinja", 2, 70),
              row("fan3", "RallyRider", 3, 60),
            ],
          },
        },
      }),
    );
    await page.goto("/play");
    await expect(
      page.getByRole("heading", { name: "Hong Kong Open 2026" }),
    ).toBeVisible();
    await expect(
      page.getByText(/17\s*[–-]\s*23 Nov.*Day 3 of 6/),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Players on the Hong Kong tournament court",
      }),
    ).toBeVisible();
    const ranks = page.getByRole("region", { name: "Live rankings" });
    await expect(ranks.getByRole("link", { name: /Countries/ })).toContainText(
      "Malaysia",
    );
    await expect(ranks.getByRole("link", { name: /Fans/ })).toHaveAttribute(
      "href",
      "/play/standings?league=players",
    );
    const cards = page
      .getByRole("region", { name: "Your challenges" })
      .getByRole("listitem");
    await expect(cards).toHaveCount(6);
    await expect(page.getByText("2 live now", { exact: true })).toBeVisible();
    await expect(ranks.locator(".arena-live-dot")).toBeVisible();
    await expect(cards.nth(0)).toContainText("Aster vs Blaze");
    await expect(cards.nth(1)).toContainText("Day 3 quiz");
    await expect(cards.nth(0).locator("time")).toHaveText("Thu 21:00");
    await expect(cards.nth(2)).toContainText("Opens Fri 08:00");
    await expect(
      ranks.getByText("Sign in to join your country", { exact: true }),
    ).toHaveCount(3);
    if (info.project.name === "mobile") {
      const track = ranks.locator(".arena-rank-track");
      const [first, next] = await Promise.all([
        track.locator(".arena-rank-card").nth(0).boundingBox(),
        track.locator(".arena-rank-card").nth(1).boundingBox(),
      ]);
      const bounds = await track.boundingBox();
      expect(first!.width / bounds!.width).toBeCloseTo(0.86, 1);
      expect(next!.x).toBeLessThan(bounds!.x + bounds!.width);
      const nav = await page
        .getByRole("navigation", { name: "Fan arena" })
        .boundingBox();
      const content = await page.locator(".arena-scroll").boundingBox();
      expect(content!.y + content!.height).toBeLessThan(nav!.y);
      const firstChallenge = await cards.first().boundingBox();
      expect(firstChallenge!.y + firstChallenge!.height).toBeLessThanOrEqual(
        content!.y + content!.height,
      );
    }
    await expect(cards.nth(4)).toContainText("+40 XP");
    await expect(cards.nth(5)).toContainText("Missed");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(ranks.getByRole("link", { name: /Countries/ })).toContainText(
      "240 XP",
    );
    await page.screenshot({
      path: path.resolve(
        "../../outputs",
        `BadmintonXP-arena-${viewport.width}x${viewport.height}.png`,
      ),
      fullPage: false,
      animations: "disabled",
    });
    const countryInfo = ranks.getByRole("button", {
      name: "Top 10 fans count (country)",
    });
    await countryInfo.click();
    const sheet = page.getByRole("dialog", { name: "Top 10 fans count" });
    await expect(sheet).toContainText(
      "Each country's score is its top 10 fans' XP this tournament.",
    );
    await page.screenshot({
      path: path.resolve(
        "../../outputs",
        `BadmintonXP-top-fans-sheet-${viewport.width}x${viewport.height}.png`,
      ),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(countryInfo).toBeFocused();
    if (info.project.name === "mobile")
      await ranks.getByRole("button", { name: "Show Teams" }).click();
    await ranks.getByRole("link", { name: /Teams/ }).click();
    await expect(page).toHaveURL(/\/play\/standings\?league=teams$/);
    await expect(page.getByRole("region", { name: "Teams" })).toBeVisible();
    await page
      .getByRole("region", { name: "Teams" })
      .getByRole("button", { name: "Top 10 fans count (team)" })
      .click();
    await expect(sheet).toContainText(
      "Each team's score is its top 10 fans' XP this tournament.",
    );
    await sheet.getByRole("button", { name: "Got it" }).click();
    await expect(sheet).toBeHidden();

    home.server_now = "2026-11-23T10:00:00Z";
    await page.goto("/play");
    await expect(
      page.getByRole("heading", { name: "Live rankings" }),
    ).toBeVisible();
    await expect(page.getByText("Awaiting final results")).toBeVisible();
    finalRankings = true;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Final rankings" }),
    ).toBeVisible();
    await expect(page.locator(".arena-live-dot")).toHaveCount(0);
    await expect(page.getByText(/live now/)).toHaveCount(0);
  });
});

test("the arena is installable and serves an offline shell without caching API data", async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "BadmintonXP",
    short_name: "BadmintonXP",
    start_url: "/play",
    display: "standalone",
  });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    const png = await response.body();
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  expect(
    manifest.icons.some(
      (icon: { purpose: string }) => icon.purpose === "maskable",
    ),
  ).toBe(true);
  await page.goto("/play");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/badmintonxp-apple.png",
  );
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    )
    .toContain("/badmintonxp-sw.js");
  const deviceConfig = await page.evaluate(() =>
    fetch("/api/push/config").then((response) => response.json()),
  );
  expect(Object.keys(deviceConfig)).toEqual(["publicKey"]);
  expect(
    (await request.post("/api/push/send", { data: { kind: "quiz" } })).status(),
  ).toBe(401);
  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) =>
      name.startsWith("badmintonxp-shell-"),
    );
    return (
      await Promise.all(
        names.map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (entry) => new URL(entry.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(cached).toContain("/badmintonxp-offline.html");
  expect(cached.some((url) => url.startsWith("/api/") || url === "/play")).toBe(
    false,
  );
  await page.context().setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You’re offline" }),
  ).toBeVisible();
});
