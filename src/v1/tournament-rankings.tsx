"use client";

import Link from "next/link";
import { useState } from "react";
import type { Profile, Tournament } from "./types";
import { ArenaSkeleton } from "./game-ui";

const leagues = ["countries", "teams", "players"] as const;
type League = (typeof leagues)[number];
type Entry = {
  id: string;
  name: string;
  xp: number;
  rank: number;
  gap: number | null;
  fans: number;
};
type Winners = Record<League, Entry[]>;
export type TournamentRankings = {
  tournament_id: string | null;
  final: boolean;
  boards: Record<League, Entry[]>;
  past: { id: string; name: string; winners: Winners }[];
};
const names = { countries: "Countries", teams: "Teams", players: "Fans" };
const titles = { countries: "Country", teams: "Team", players: "Fan" };
const dayMs = 86_400_000;

function entryName(entry: Entry, league: League) {
  if (league !== "countries") return entry.name;
  const code = entry.id.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return entry.name;
  const flag = String.fromCodePoint(
    ...Array.from(code, (letter) => 127397 + letter.charCodeAt(0)),
  );
  return `${flag} ${new Intl.DisplayNames(["en"], { type: "region" }).of(code)}`;
}

function tournamentStatus(tournament: Tournament, now: number, final: boolean) {
  if (final) return "Final standings";
  const starts = Date.parse(tournament.starts_at);
  const ends = Date.parse(tournament.ends_at);
  if (now < starts) {
    const days = Math.ceil((starts - now) / dayMs);
    return `Starts in ${days} ${days === 1 ? "day" : "days"}`;
  }
  if (now >= ends) return "Awaiting final results";
  return `Day ${Math.floor((now - starts) / dayMs) + 1} of ${Math.ceil((ends - starts) / dayMs)}`;
}

function WinnerList({ winners }: { winners: Winners }) {
  return (
    <ul>
      {leagues.map((league) => {
        const leaders = winners[league];
        if (!leaders.length) return null;
        return (
          <li key={league}>
            <strong>
              {leaders.length > 1
                ? `Joint #1 ${titles[league]} champions`
                : `#1 ${titles[league]}`}
            </strong>
            {" · "}
            {leaders
              .map((winner) => `${entryName(winner, league)} · ${winner.xp} XP`)
              .join(" / ")}
          </li>
        );
      })}
    </ul>
  );
}

export function RaceSummary({
  data,
  profile,
  tournament,
}: {
  data: TournamentRankings;
  profile: Profile;
  tournament: Tournament;
}) {
  const country = data.boards.countries.find(
    (row) => row.id === profile.country,
  );
  const player = data.boards.players.find((row) => row.id === profile.id);
  return (
    <Link className="panel race-summary" href="/play/standings">
      <strong>{tournament.name} standings →</strong>
      <span>
        {country
          ? `${entryName(country, "countries")} is #${country.rank}${country.gap ? `, ${country.gap} XP behind ${entryName(data.boards.countries[data.boards.countries.indexOf(country) - 1], "countries")}` : ""}`
          : "Your country is unranked."}
      </span>
      <span>
        {player
          ? `You’re #${player.rank}${player.gap ? `, ${player.gap} XP behind ${data.boards.players[data.boards.players.indexOf(player) - 1].name}` : ""}`
          : "You’re unranked. Score XP to enter the race."}
      </span>
    </Link>
  );
}

export function TournamentStandings({
  tournament,
  now,
  data,
  failed,
  profile,
}: {
  tournament: Tournament | null;
  now: number;
  data: TournamentRankings | null;
  failed: boolean;
  profile: Profile | null;
}) {
  const [mobileLeague, setMobileLeague] = useState<League>("countries");
  return (
    <section className="standings-section tournament-standings">
      <h1>{tournament?.name ?? "Tournament rankings"}</h1>
      {tournament && (
        <p>{tournamentStatus(tournament, now, data?.final ?? false)}</p>
      )}
      <p>
        Everyone starts at 0. 10 XP per correct quiz answer, 20 XP per correct
        prediction. Top fan, team and country win the tournament.
      </p>
      {failed ? (
        <p role="status">Rankings are temporarily unavailable.</p>
      ) : !data ? (
        <ArenaSkeleton label="Loading rankings" />
      ) : (
        <>
          {data.final && (
            <section className="panel">
              <h2>Champions</h2>
              <WinnerList
                winners={{
                  players: data.boards.players.filter((row) => row.rank === 1),
                  countries: data.boards.countries.filter(
                    (row) => row.rank === 1,
                  ),
                  teams: data.boards.teams.filter((row) => row.rank === 1),
                }}
              />
            </section>
          )}
          {tournament ? (
            <>
              <div
                className="race-tabs filter-row"
                role="group"
                aria-label="Ranking categories"
              >
                {leagues.map((league) => (
                  <button
                    key={league}
                    type="button"
                    aria-pressed={league === mobileLeague}
                    onClick={() => setMobileLeague(league)}
                  >
                    {names[league]}
                  </button>
                ))}
              </div>
              <div className="race-grid">
                {leagues.map((league) => {
                  const rows = data.boards[league];
                  const ownId =
                    league === "countries"
                      ? profile?.country
                      : league === "teams"
                        ? profile?.team_id
                        : profile?.id;
                  const own = rows.find((row) => row.id === ownId);
                  const top = rows.slice(0, 5);
                  const rowItem = (row: Entry) => (
                    <li
                      key={row.id}
                      className={row.id === ownId ? "race-own" : undefined}
                    >
                      <span>#{row.rank}</span>
                      <span>
                        <strong>{entryName(row, league)}</strong>
                        {row.id === ownId && <small> Your position</small>}
                        {league === "countries" && (
                          <small>
                            {row.fans} {row.fans === 1 ? "fan" : "fans"}
                          </small>
                        )}
                        {row.gap !== null && row.gap > 0 && (
                          <small>{row.gap} XP behind</small>
                        )}
                      </span>
                      <strong>{row.xp} XP</strong>
                    </li>
                  );
                  return (
                    <section
                      className="panel race-card"
                      key={league}
                      data-selected={league === mobileLeague}
                      aria-label={names[league]}
                    >
                      <h2>
                        {league === "countries"
                          ? "Country vs country"
                          : names[league]}
                      </h2>
                      {league !== "players" && <p>Top 10 fans count</p>}
                      {top.length ? (
                        <ol>{top.map(rowItem)}</ol>
                      ) : (
                        <p>No scores yet. Be the first to rally.</p>
                      )}
                      {rows.length > 5 && (
                        <details>
                          <summary>
                            View full {names[league].toLowerCase()} standings
                          </summary>
                          <ol>{rows.slice(5).map(rowItem)}</ol>
                        </details>
                      )}
                      {own && !top.includes(own) && (
                        <ol className="race-pinned" aria-label="Your position">
                          {rowItem(own)}
                        </ol>
                      )}
                      {profile && ownId && !own && (
                        <p className="race-own">Your position · Unranked</p>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <p>The first event is on its way.</p>
          )}
          {data.past.length > 0 && (
            <section className="panel race-past">
              <h2>Past champions</h2>
              {data.past.map((event) => (
                <div key={event.id}>
                  <h3>{event.name}</h3>
                  <WinnerList winners={event.winners} />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
