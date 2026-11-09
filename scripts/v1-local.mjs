// Local-only launcher: keys remain in child-process memory, never .env files or output.
import { execFileSync, spawn } from "node:child_process";
import { cpSync } from "node:fs";
let status;
try {
  status = JSON.parse(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
} catch {
  console.error(
    "The isolated local Supabase stack is not ready. Start it before launching v1. No configuration values were printed.",
  );
  process.exit(1);
}

if (new URL(status.API_URL).hostname !== "127.0.0.1" || !status.PUBLISHABLE_KEY)
  throw new Error("Only the isolated local stack is allowed.");
const production = process.argv.includes("--production");
if (production) {
  cpSync("public", ".next/standalone/public", { recursive: true });
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
}
const child = spawn(
  process.execPath,
  production
    ? [".next/standalone/server.js"]
    : [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3100",
      ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: "3100",
      V1_NEW_PROJECT_CONFIRMED: "true",
      V1_SUPABASE_URL: status.API_URL,
      V1_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
