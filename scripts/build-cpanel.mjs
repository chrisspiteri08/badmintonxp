import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Do not allow Next's dotenv loader to inline keys into an upload artifact.
const dotenv = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
];
if (dotenv.some((file) => existsSync(file))) {
  console.error(
    "cPanel build refused: move .env files out of this checkout before building. No values were read.",
  );
  process.exit(1);
}
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const name of Object.keys(env)) {
  if (
    name.startsWith("NEXT_PUBLIC_") ||
    /^(SUPABASE_|OPENAI_|GOOGLE_|GEMINI_|GENKIT_)/.test(name)
  )
    delete env[name];
}
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { env, stdio: "inherit" },
);
process.exit(result.status ?? 1);
