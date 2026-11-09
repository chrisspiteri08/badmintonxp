/** Owner-operated only. No secret values, file writes, .env loading or telemetry. */
import { createRequire } from "node:module";
import { emitKeypressEvents } from "node:readline";
import { pathToFileURL } from "node:url";
import path from "node:path";

export const ADMIN_EMAIL = "admin@badmintonxp.com";

export async function rotateWithClient(client, newPassword) {
  let target;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error)
      throw new Error(
        "Could not read users. Check the project URL and server service key. Nothing changed.",
      );
    target = data.users.find(
      (user) => user.email?.toLowerCase() === ADMIN_EMAIL,
    );
    if (target || data.users.length < 1000) break;
  }
  if (!target)
    throw new Error("The legacy admin account was not found. Nothing changed.");
  if (!target.email_confirmed_at)
    throw new Error(
      "The account email is unconfirmed. Review it in Supabase first. Nothing changed.",
    );
  if (target.banned_until && Date.parse(target.banned_until) > Date.now())
    throw new Error(
      "The account is banned. Review it in Supabase first. Nothing changed.",
    );
  const { error: updateError } = await client.auth.admin.updateUserById(
    target.id,
    { password: newPassword },
  );
  if (updateError)
    throw new Error(
      "Password update failed. No successful password change was confirmed.",
    );
  // Sign in as this exact user so global sign-out targets all of its sessions.
  const { error: signInError } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: newPassword,
  });
  if (signInError)
    throw new Error(
      "Password changed, but session revocation could not be completed. Do not repeat blindly; review the account in Supabase.",
    );
  const { error: signOutError } = await client.auth.signOut({
    scope: "global",
  });
  if (signOutError)
    throw new Error(
      "Password changed, but global sign-out failed. Review session revocation in Supabase.",
    );
}

export function readInput(label, { hidden = false } = {}) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || !process.stdout.isTTY)
      return reject(
        new Error(
          "Run this directly in your own interactive Terminal. No piped inputs are accepted.",
        ),
      );
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    process.stdout.write(label);
    let value = "";
    const cleanup = () => {
      input.off("keypress", onKey);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
    };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        if (value.length) {
          value = value.slice(0, -1);
          if (!hidden) process.stdout.write("\b \b");
        }
        return;
      }
      if (
        key.ctrl ||
        key.meta ||
        [
          "escape",
          "tab",
          "up",
          "down",
          "left",
          "right",
          "delete",
          "home",
          "end",
        ].includes(key.name)
      )
        return;
      if (text && !/[\x00-\x1f\x7f]/.test(text)) {
        value += text;
        if (!hidden) process.stdout.write(text);
      }
    };
    input.on("keypress", onKey);
  });
}

async function main() {
  console.log("Owner-only password rotation for " + ADMIN_EMAIL + ".");
  console.log(
    "Run in a private Terminal, not screen sharing or session recording. Secrets are never echoed or saved.",
  );
  let url;
  try {
    url = new URL((await readInput("Supabase project URL: ")).trim());
  } catch {
    throw new Error("Invalid project URL. Nothing changed.");
  }
  // Never send your service key to an arbitrary host or embedded redirect target.
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !["", "/"].includes(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use the HTTPS project URL from the Supabase dashboard (*.supabase.co). Nothing changed.",
    );
  let serviceKey = (
    await readInput("Server service key (hidden): ", { hidden: true })
  ).trim();
  let password = await readInput(
    "New admin password, at least 12 characters (hidden): ",
    { hidden: true },
  );
  let confirm = await readInput("Repeat new password (hidden): ", {
    hidden: true,
  });
  if (password.length < 12 || password !== confirm || !serviceKey)
    throw new Error(
      "Inputs are empty, too short or do not match. Nothing changed.",
    );
  confirm = "";
  const approval = await readInput(
    "Change this password and sign out ALL its sessions? Type ROTATE: ",
  );
  if (approval !== "ROTATE") {
    serviceKey = "";
    password = "";
    throw new Error("Cancelled. Nothing changed.");
  }
  const require = createRequire(new URL("../package.json", import.meta.url));
  const { createClient } = require("@supabase/supabase-js");
  const client = createClient(url.origin, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  try {
    await rotateWithClient(client, password);
    console.log(
      "Password changed. Global sign-out completed. Existing access tokens may remain valid until their normal expiry.",
    );
  } finally {
    serviceKey = "";
    password = "";
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    // Only our fixed error messages are printed; SDK response bodies and inputs are not.
    const safe = [
      "Could not read users.",
      "The legacy admin account",
      "The account email",
      "The account is banned.",
      "Password update failed.",
      "Password changed,",
      "Cancelled.",
      "Invalid project URL.",
      "Use the HTTPS project URL",
      "Inputs are empty",
      "Run this directly",
    ];
    console.error(
      safe.some((prefix) => error.message?.startsWith(prefix))
        ? error.message
        : "Could not complete the operation. No secret details are printed.",
    );
    process.exitCode = 1;
  });
}
