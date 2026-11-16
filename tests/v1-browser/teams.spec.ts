import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fixture, local, password } from "./local";

test("team signup, invite switching and sharing without a native share sheet", async ({
  page,
}, info) => {
  const tag = randomUUID().slice(0, 8);
  const f = await fixture(tag);
  const c = local();
  const email = `teams-${tag}@example.test`;
  const pass = password();
  const name = "Rally Falcons";
  const fixtureTeam = {
    id: "f4000000-0000-4000-8000-000000000001",
    name,
    invite_code: "c0ffeefeed01",
    member_count: 3,
  };
  const { data: legacy } = await c.admin
    .from("teams")
    .select("id,name,invite_code")
    .eq("id", f.team)
    .maybeSingle();
  const target = legacy ? { ...legacy, member_count: 0 } : fixtureTeam;
  const capture = (screen: string) => {
    const { width, height } = page.viewportSize()!;
    return page.screenshot({
      path: path.resolve(
        process.env.TEAM_SCREENSHOT_DIR ?? "../../outputs/fan-teams",
        `${screen}-${width}x${height}.png`,
      ),
      animations: "disabled",
    });
  };
  await page.setViewportSize(
    info.project.name === "mobile"
      ? { width: 360, height: 800 }
      : { width: 1440, height: 900 },
  );
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "share", { value: undefined }),
  );
  await page.route("**/rest/v1/rpc/v1_home", async (route) => {
    const response = await route.fetch();
    const home = await response.json();
    if (!home.teams.some((team: { id: string }) => team.id === target.id))
      home.teams.push(target);
    if (home.profile) home.profile.team_id = fixtureTeam.id;
    await route.fulfill({ response, json: home });
  });
  await page.route("**/rest/v1/rpc/v1_my_team", (route) =>
    route.fulfill({ json: fixtureTeam }),
  );

  await page.route("**/rest/v1/rpc/v1_tournament_rankings", (route) =>
    route.fulfill({
      json: {
        tournament_id: f.tournament,
        final: false,
        past: [],
        boards: {
          countries: [],
          players: [],
          teams: [
            { id: fixtureTeam.id, name, xp: 20, rank: 2, fans: 3, gap: 10 },
          ],
        },
      },
    }),
  );
  await page.goto(`/join/${target.invite_code}`);
  await expect(page.getByRole("heading", { name: target.name })).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    `Join ${target.name} on BadmintonXP`,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /badmintonxp-arena-unbranded\.jpg/,
  );
  await expect(
    page.getByRole("link", { name: `Join ${target.name}` }),
  ).toBeVisible();
  await capture("join");
  await page.getByRole("link", { name: `Join ${target.name}` }).click();
  await expect(
    page.getByRole("radio", { name: "Join an existing team" }),
  ).toBeChecked();
  await expect(page.getByLabel("Choose a team")).toHaveValue(target.id);
  await page.getByLabel("Search teams").fill(target.name);
  await expect(page.getByRole("option", { name: target.name })).toHaveCount(1);
  await page.getByRole("radio", { name: "Create a team" }).check();
  await page.getByLabel("Team name").fill(name);
  await page.getByLabel("Team name").scrollIntoViewIfNeeded();
  await capture("signup-team");

  // This confirmed account has the same signup metadata that the real form sends.
  expect(
    (
      await c.admin.auth.admin.createUser({
        email,
        password: pass,
        email_confirm: true,
        user_metadata: { team_name_request: name },
      })
    ).error,
  ).toBeNull();
  let creates = 0;
  await page.route("**/rest/v1/rpc/v1_create_fan_team", (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_name: name });
    creates++;
    return route.fulfill({ json: fixtureTeam });
  });
  await page.goto("/play/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your team is ready." }),
  ).toBeVisible();
  expect(creates).toBe(1);
  await page.getByRole("button", { name: "Share invite" }).click();
  for (const button of ["WhatsApp", "X"]) {
    const href = await page
      .getByRole("link", { name: button, exact: true })
      .getAttribute("href");
    expect(new URL(href!).searchParams.get("text")).toBe(
      `Join my team ${name} on BadmintonXP 🏸 Free badminton quiz and predictions. Let's beat the world: ${new URL(`/join/${fixtureTeam.invite_code}`, page.url()).href}`,
    );
  }
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  await capture("share");

  await page.goto("/play");
  const card = page.getByRole("region", { name: "Your team" });
  await expect(card.getByRole("heading", { name })).toBeVisible();
  await expect(
    card.getByText("3 of 10 scoring spots filled. Invite 7 more."),
  ).toBeVisible();
  await expect(card.getByText(/Tournament rank #2/)).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await capture("play-team");
  await card.getByRole("button", { name: "Invite friends" }).click();
  await expect(page.getByRole("dialog", { name: "Team invite" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  const switchRequests: boolean[] = [];
  await page.route("**/rest/v1/rpc/v1_join_fan_team", (route) => {
    const payload = route.request().postDataJSON();
    expect(payload.p_code).toBe(target.invite_code);
    switchRequests.push(payload.p_confirm_switch);
    return route.fulfill({
      json: payload.p_confirm_switch
        ? { ...target, member_count: target.member_count + 1 }
        : { confirm_switch: true },
    });
  });
  await page.goto(`/join/${target.invite_code}`);
  await page.getByRole("button", { name: `Join ${target.name}` }).click();
  const confirm = page.getByRole("group", { name: "Confirm team switch" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  expect(switchRequests).toEqual([false]);
  await page.getByRole("button", { name: `Join ${target.name}` }).click();
  await confirm.getByRole("button", { name: "Switch team" }).click();
  await expect(page.getByRole("status")).toHaveText(
    `You’re on ${target.name}.`,
  );
  expect(switchRequests).toEqual([false, false, true]);

  await page.route("**/rest/v1/rpc/v1_join_fan_team", (route) => {
    expect(route.request().postDataJSON().p_confirm_switch).toBe(false);
    return route.fulfill({ json: target });
  });
  await page.reload();
  await page.getByRole("button", { name: `Join ${target.name}` }).click();
  await expect(page.getByRole("status")).toHaveText(
    `You’re on ${target.name}.`,
  );
});
