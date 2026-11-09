import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export function local() {
  if (process.env.V1_LOCAL_E2E !== "1")
    throw new Error(
      "Set V1_LOCAL_E2E=1; these tests only target the isolated local stack.",
    );
  const config = JSON.parse(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (config.API_URL !== "http://127.0.0.1:54321")
    throw new Error("Refusing a non-local API.");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    admin: createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
    player: () => createClient(config.API_URL, config.ANON_KEY, options),
    mail: config.MAILPIT_URL,
  };
}
export const password = () => randomBytes(24).toString("base64url") + "aA1!";
export function sql(statement: string) {
  // Hard-coded LOCAL container. Never accepts a host, password or production project reference.
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_badmintonxp-v1-local",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
}
export async function fixture(tag: string) {
  const { admin, player } = local();
  const email = `admin-${tag}@example.test`,
    pass = password();
  const result = await admin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
  });
  if (result.error) throw new Error("Could not create isolated admin fixture.");
  const user = result.data.user;
  sql(`insert into private.admins(user_id) values('${user.id}');`);
  const owner = player();
  const login = await owner.auth.signInWithPassword({ email, password: pass });
  if (login.error) throw new Error("Could not sign in isolated fixture.");
  const save = async (kind: string, data: Record<string, unknown>) => {
    const result = await owner.rpc("v1_admin_save", {
      p_kind: kind,
      p_data: data,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data as string;
  };
  const team = await save("team", { name: `Neon ${tag}` });
  const season = await save("season", { name: `Test season ${tag}` });
  const tournament = await save("tournament", {
    name: `Isolated Cup ${tag}`,
    season_id: season,
    starts_at: new Date(Date.now() - 86400000).toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
  });
  const match = await save("match", {
    tournament_id: tournament,
    athlete_a: "Ember",
    athlete_b: "Kite",
    closes_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const quiz = await save("quiz", {
    tournament_id: tournament,
    title: `Shuttle IQ ${tag}`,
    opens_at: new Date(Date.now() - 3600000).toISOString(),
    closes_at: new Date(Date.now() + 3600000).toISOString(),
  });
  for (let position = 0; position < 3; position++)
    await save("question", {
      quiz_id: quiz,
      position,
      prompt: `How many feathers are on a shuttle? Round ${position + 1}`,
      options: ["12", "14", "16", "18"],
      correct_option: 2,
      explanation: "A feather shuttle has 16 feathers.",
    });
  await save("publish_quiz", { id: quiz });
  await save("publish_tournament", { id: tournament });
  return { owner, admin, email, pass, team, tournament, match, quiz, user };
}
