import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let pending: Promise<SupabaseClient | null> | undefined;
export function v1Client(): Promise<SupabaseClient | null> {
  if (!pending)
    pending = (async () => {
      const response = await fetch("/api/v1/config", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          "The test connection is unavailable. Please try again.",
        );
      const config = await response.json();
      if (!config.ready) return null;
      return createClient(config.url, config.key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "badmintonxp-v1-auth",
        },
      });
    })();
  return pending;
}
export function friendlyError(error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  if (message.includes("profiles_username_unique"))
    return "That username is taken. Try another.";
  if (message.includes("check constraint"))
    return "Check the fields and try again. Usernames need 3–24 letters, numbers or underscores.";
  if (message.includes("Invalid login credentials"))
    return "Email or password didn’t match.";
  if (message.includes("Email not confirmed"))
    return "Confirm your email before signing in.";
  if (message.includes("rate limit") || message.includes("too many"))
    return "Please wait a moment before trying again.";
  if (
    /^(Sign in|Admin access|Quiz |Predictions |Choose |Your team|Match |Wait until|Invalid winner|Result already|Published |Add |Provide |The test connection|Unable to validate email)/.test(
      message,
    )
  )
    return message;
  return "We couldn’t complete that action. Check your details and try again.";
}
