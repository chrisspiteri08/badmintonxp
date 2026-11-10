// Health probes use only the public v1 credential; never a service role or caller token.
export async function databaseConnected(
  config: { ready: boolean; url?: string; key?: string },
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!config.ready || !config.url || !config.key) return false;
  try {
    // An actual, bounded DB read: an empty seasons table is healthy too.
    const url = new URL("/rest/v1/seasons?select=id&limit=1", config.url);
    const response = await fetcher(url, {
      headers: { apikey: config.key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const rows: unknown = await response.json();
    return Array.isArray(rows) && rows.length <= 1;
  } catch {
    return false;
  }
}
