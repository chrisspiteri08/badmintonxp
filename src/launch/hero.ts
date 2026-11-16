// Read only the artwork for the current public tournament.
export async function landingHeroUrl(
  config: { ready: boolean; url?: string; key?: string },
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!config.ready || !config.url || !config.key) return null;

  try {
    const endpoint = new URL("/rest/v1/tournaments", config.url);
    endpoint.search =
      "select=hero_image_url&active=eq.true&published=eq.true&limit=1";
    const response = await fetcher(endpoint, {
      headers: { apikey: config.key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const image = Array.isArray(rows) ? rows[0]?.hero_image_url : null;
    if (typeof image !== "string") return null;
    const url = new URL(image);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
