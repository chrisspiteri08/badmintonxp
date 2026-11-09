export function publicV1Config(env: Record<string, string | undefined>) {
  const url = env.V1_SUPABASE_URL;
  const key = env.V1_SUPABASE_PUBLISHABLE_KEY;
  if (env.V1_NEW_PROJECT_CONFIRMED !== "true" || !url || !key)
    return { ready: false as const };
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    )
      return { ready: false as const };
    if (key.split(".").length === 3) {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      if (payload.role !== "anon") return { ready: false as const };
    } else if (!key.startsWith("sb_publishable_"))
      return { ready: false as const };
    return { ready: true as const, url, key };
  } catch {
    return { ready: false as const };
  }
}
