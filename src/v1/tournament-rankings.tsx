"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

export function tournamentStatus(
  tournament: Tournament,
  now: number,
  final: boolean,
) {
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

function ownEntry(rows: Entry[], league: League, profile: Profile | null) {
  const id =
    league === "countries"
      ? profile?.country
      : league === "teams"
        ? profile?.team_id
        : profile?.id;
  return rows.find((row) => row.id === id);
}

function AnimatedRankScore({ xp }: { xp: number }) {
  const [shown, setShown] = useState(xp);
  const previous = useRef(0);
  useEffect(() => {
    const from = previous.current;
    previous.current = xp;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      from === xp
    ) {
      setShown(xp);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const draw = (time: number) => {
      const progress = Math.min(1, (time - start) / 450);
      setShown(Math.round(from + (xp - from) * progress));
      if (progress < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [xp]);
  return <strong aria-label={`${xp} XP`}>{shown} XP</strong>;
}

export function ArenaRankings({
  data,
  profile,
  failed,
}: {
  data: TournamentRankings | null;
  profile: Profile | null;
  failed: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const previous = useRef<TournamentRankings | null>(null);
  const [gainers, setGainers] = useState<string[]>([]);
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    const prior = previous.current;
    previous.current = data;
    if (!prior || !data || prior.tournament_id !== data.tournament_id) {
      setGainers([]);
      return;
    }
    setGainers(
      leagues.flatMap((league) =>
        data.boards[league].flatMap((row) => {
          const old = prior.boards[league].find((item) => item.id === row.id);
          return old && old.rank > row.rank ? [`${league}:${row.id}`] : [];
        }),
      ),
    );
  }, [data]);
  const rowsExist =
    data && leagues.some((league) => data.boards[league].length > 0);
  return (
    <section className="arena-rankings" aria-labelledby="arena-rankings-title">
      <h2 id="arena-rankings-title">Tournament rankings</h2>
      {failed ? (
        <p role="status">Rankings are temporarily unavailable.</p>
      ) : data === null ? (
        <ArenaSkeleton label="Loading rankings" />
      ) : !rowsExist ? (
        <p className="panel">Rankings open when the first quiz goes live.</p>
      ) : (
        <>
          <div
            className="arena-rank-track"
            ref={track}
            onScroll={(event) => {
              const container = event.currentTarget;
              const nearest = Array.from(container.children).findIndex(
                (child) =>
                  Math.abs(
                    child.getBoundingClientRect().left -
                      container.getBoundingClientRect().left,
                  ) <
                  child.clientWidth / 2,
              );
              if (nearest >= 0) setVisible(nearest);
            }}
          >
            {leagues.map((league) => {
              const rows = data.boards[league];
              const own = ownEntry(rows, league, profile);
              const above = own && rows[rows.indexOf(own) - 1];
              return (
                <Link
                  className="panel arena-rank-card"
                  href={`/play/standings?league=${league}`}
                  key={league}
                >
                  <h3>
                    {names[league]} <span aria-hidden="true">↗</span>
                  </h3>
                  <ol>
                    {rows.slice(0, 3).map((row, index) => (
                      <li
                        key={row.id}
                        data-place={index + 1}
                        data-gained={gainers.includes(`${league}:${row.id}`)}
                      >
                        <b>#{row.rank}</b>
                        <span>
                          {league === "countries"
                            ? entryName(row, league)
                            : `${["🥇", "🥈", "🥉"][index]} ${row.name}`}
                        </span>
                        <AnimatedRankScore xp={row.xp} />
                      </li>
                    ))}
                  </ol>
                  {!rows.length && <p>No scores yet</p>}
                  <p className="arena-own-rank">
                    {profile ? (
                      <>
                        <strong>You</strong>
                        {league !== "players" &&
                          ` · Your ${titles[league].toLowerCase()}`}
                        :{" "}
                        {own
                          ? `#${own.rank}${own.gap && above ? ` · ${own.gap} XP behind #${above.rank}` : ""}`
                          : "Unranked"}
                      </>
                    ) : (
                      "Sign in to join your country"
                    )}
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="arena-rank-dots" aria-label="Ranking cards">
            {leagues.map((league, index) => (
              <button
                type="button"
                key={league}
                aria-label={`Show ${names[league]}`}
                aria-current={visible === index ? "true" : undefined}
                onClick={() => {
                  const card = track.current?.children[index];
                  if (card && track.current)
                    track.current.scrollTo({
                      left:
                        card.getBoundingClientRect().left -
                        track.current.getBoundingClientRect().left +
                        track.current.scrollLeft,
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    });
                }}
              >
                <span />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
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
  useEffect(() => {
    const league = new URLSearchParams(window.location.search).get("league");
    if (league === "countries" || league === "teams" || league === "players") {
      setMobileLeague(league);
    }
  }, []);
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
