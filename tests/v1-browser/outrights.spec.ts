import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fixture, local, password } from "./local";

test("champion picks can change before close and settle once through the admin desk", async ({
  page,
}, info) => {
  const f = await fixture(randomUUID().slice(0, 8));
  const ctx = local();
  const pass = password();
  const email = `champion-${randomUUID()}@example.test`;
  const created = await ctx.admin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  await page.setViewportSize(
    info.project.name === "mobile"
      ? { width: 360, height: 800 }
      : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const capture = async (
    name: string,
    locator?: import("@playwright/test").Locator,
  ) => {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    if (locator)
      await locator.evaluate((element) => {
        (element.closest("details") ?? element).scrollIntoView({
          block: "start",
        });
      });
    const size = page.viewportSize()!;
    await page.screenshot({
      path: path.resolve(
        process.env.OUTRIGHT_SCREENSHOT_DIR ?? "../../outputs/champion-picks",
        `${name}-${size.width}x${size.height}.png`,
      ),
      animations: "disabled",
    });
  };
  async function signIn(address: string, secret: string) {
    await page.goto("/play/account");
    await page.getByLabel("Email", { exact: true }).fill(address);
    await page.getByLabel("Password", { exact: true }).fill(secret);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "You’re in." }),
    ).toBeVisible();
  }
  async function signOut() {
    await page.goto("/play/profile");
    await page.getByRole("button", { name: "Sign out all sessions" }).click();
    await expect(
      page.getByRole("heading", { name: "Join the rally." }),
    ).toBeVisible();
  }
  // Scope the real admin response to this fixture so old local runs do not
  // create thousands of offscreen rows in this screenshot test.
  await page.route("**/rest/v1/rpc/v1_admin_snapshot", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    snapshot.tournaments = snapshot.tournaments.filter(
      (event: { id: string }) => event.id === f.tournament,
    );
    snapshot.matches = snapshot.matches.filter(
      (match: { id: string }) => match.id === f.match,
    );
    snapshot.quizzes = snapshot.quizzes.filter(
      (quiz: { id: string }) => quiz.id === f.quiz,
    );
    snapshot.questions = snapshot.questions.filter(
      (question: { quiz_id: string }) => question.quiz_id === f.quiz,
    );
    snapshot.outrights = snapshot.outrights.filter(
      (item: { tournament_id: string }) => item.tournament_id === f.tournament,
    );
    await route.fulfill({ response, json: snapshot });
  });
  await signIn(f.email, f.pass);
  await page.goto("/play/admin");
  await page.getByText("4b. Add a champion pick", { exact: true }).click();
  const form = page.getByRole("form", { name: "4b. Add a champion pick" });
  await form
    .getByRole("combobox", { name: "Tournament", exact: true })
    .selectOption(f.tournament);
  await form
    .getByLabel("Title", { exact: true })
    .fill("Who wins the singles championship?");
  await form.getByLabel("Event label", { exact: true }).fill("Singles");
  await form
    .getByLabel("Options (one per line)")
    .fill("Aster (MT)\nBlaze (MY)\nCedar (JP)");
  const close = new Date(Date.now() + 3_600_000);
  const localClose = new Date(
    close.getTime() - close.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 16);
  await form.getByLabel("Predictions close", { exact: true }).fill(localClose);
  await capture("admin-add", form);
  await form.getByRole("button", { name: "Save champion pick" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Champion pick added." }),
  ).toBeVisible();
  const rows = await ctx.admin
    .from("outrights")
    .select("id")
    .eq("tournament_id", f.tournament)
    .single();
  expect(rows.error).toBeNull();
  const id = rows.data!.id;
  const results = page.getByRole("region", { name: "Enter champion results" });
  await expect(
    results.getByRole("button", { name: "Blaze (MY) wins", exact: true }),
  ).toBeDisabled();
  await signOut();
  await signIn(email, pass);
  await page.goto("/play");
  const arenaCard = page
    .getByRole("listitem")
    .filter({ hasText: "Who wins the singles championship?" });
  await expect(arenaCard).toContainText("Champion pick");
  await capture("arena-item", arenaCard);
  await arenaCard.getByRole("link", { name: "Pick", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`outright=${id}`));
  const panel = page.locator(`#outright-${id}`);
  await expect(panel.getByTestId("v1-outright-status")).toHaveText(
    "Pick the champion. A correct pick earns 20 XP.",
  );
  await capture("predict-open", panel);
  await panel.getByRole("button", { name: "Aster (MT)", exact: true }).click();
  await panel
    .getByRole("button", { name: "Confirm pick", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Aster (MT)", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "Blaze (MY)", exact: true }).click();
  await panel
    .getByRole("button", { name: "Confirm pick", exact: true })
    .click();
  await expect(panel.getByTestId("v1-outright-status")).toContainText(
    "Your pick: Blaze (MY). You can change it until",
  );
  await capture("predict-picked", panel);
  const ownPicks = await ctx.admin
    .from("outright_picks")
    .select("id")
    .eq("outright_id", id);
  expect(ownPicks.data).toHaveLength(1);
  const updated = await ctx.admin
    .from("outrights")
    .update({ closes_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", id);
  expect(updated.error).toBeNull();
  await signOut();
  await signIn(f.email, f.pass);
  await page.goto("/play/admin");
  await capture("admin-results", results);
  await results
    .getByRole("button", { name: "Blaze (MY) wins", exact: true })
    .click();
  await results
    .getByRole("button", { name: "Confirm champion", exact: true })
    .click();
  await expect(
    results.getByText("Final: Blaze (MY) is champion."),
  ).toBeVisible();
  await signOut();
  await signIn(email, pass);
  await page.goto(`/play/predict?outright=${id}`);
  await expect(panel.getByTestId("v1-outright-status")).toHaveText(
    "Won · Blaze (MY) is champion! +20 XP",
  );
  await capture("predict-won", panel);
  const ledger = await ctx.admin
    .from("xp_ledger")
    .select("xp")
    .eq("source_type", "outright")
    .eq("source_id", id);
  expect(ledger.data).toEqual([{ xp: 20 }]);
});
