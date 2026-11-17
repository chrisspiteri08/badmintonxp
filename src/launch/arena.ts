import type { Home } from "@/v1/types";

type CountryScore = { id: string; name: string; xp: number };
type Rankings = {
  tournament_id: string | null;
  boards: { countries: CountryScore[] };
};

export async function landingArena(
  config: { ready: boolean; url?: string; key?: string },
  fetcher: typeof fetch = fetch,
) {
  if (!config.ready || !config.url || !config.key) return null;
  const { url, key } = config;
  const signal = AbortSignal.timeout(2500);

  async function read<T>(fn: string): Promise<T | null> {
    try {
      const response = await fetcher(new URL(`/rest/v1/rpc/${fn}`, url), {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        redirect: "error",
        signal,
      });
      return response.ok ? ((await response.json()) as T) : null;
    } catch {
      return null;
    }
  }

  const [home, rankings] = await Promise.all([
    read<Home>("v1_home"),
    read<Rankings>("v1_tournament_rankings"),
  ]);
  const tournament = home?.tournament;
  if (!home || !tournament) return null;
  const now = Date.parse(home.server_now);
  const start = Date.parse(tournament.starts_at);
  const end = Date.parse(tournament.ends_at);
  const live = now >= start && now < end;
  const totalDays = Math.max(1, Math.ceil((end - start) / 86_400_000));
  const day = Math.min(totalDays, Math.floor((now - start) / 86_400_000) + 1);
  const playable = [
    ...home.quizzes,
    ...home.matches.filter((match) => !match.winner),
  ]
    .map((challenge) => ({
      opens: Date.parse(challenge.opens_at ?? tournament.starts_at),
      closes: Date.parse(challenge.closes_at),
    }))
    .filter((challenge) => challenge.closes > now);
  const nextOpening = playable
    .map(({ opens }) => opens)
    .filter((opens) => opens > now)
    .sort((a, b) => a - b)[0];
  const nextClose = playable
    .map(({ closes }) => closes)
    .sort((a, b) => a - b)[0];
  const deadline = nextOpening ?? nextClose;
  const countries =
    rankings?.tournament_id === tournament.id
      ? rankings.boards.countries.slice(0, 3)
      : [];
  return {
    name: tournament.name,
    hero: tournament.hero_image_url?.startsWith("https://")
      ? tournament.hero_image_url
      : null,
    live,
    day,
    totalDays,
    deadline,
    now,
    timerLabel: nextOpening ? "Next challenge opens in" : "Challenge closes in",
    countries,
  };
}
