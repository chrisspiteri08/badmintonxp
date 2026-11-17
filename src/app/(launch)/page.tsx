import type { Metadata } from "next";
import { GameButton } from "@/v1/game-button";
import Image from "next/image";
import { landingArena } from "@/launch/arena";
import { ChallengeClock } from "@/launch/challenge-clock";
import { Flag, Globe2, Target, Trophy, Users, Zap } from "lucide-react";
import { publicV1Config } from "@/v1/config";

export const dynamic = "force-dynamic";

const headline = "Pick your country. Beat the world.";
const title = `BadmintonXP | ${headline}`;
const description =
  "A free badminton quiz and prediction game. Officially launching at the World Tour Finals, 9–13 Dec.";

export const metadata: Metadata = {
  metadataBase: new URL("https://badmintonxp.com"),
  title,
  description,
  openGraph: { title, description, url: "/", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const benefits = [
  {
    icon: Globe2,
    chip: "Live rankings",
    type: "rankings",
    title: "Play for your country",
    copy: "Every point you score lifts your nation in the live country rankings.",
  },
  {
    icon: Target,
    chip: "+20 XP",
    type: "prediction",
    title: "Call the big match",
    copy: "Predict one featured match a day. Get it right for +20 XP.",
  },
  {
    icon: Zap,
    chip: "+10 XP",
    type: "quiz",
    title: "Daily badminton quiz",
    copy: "Quick questions every day of the tournament, easy to hard. +10 XP each.",
  },
  {
    icon: Users,
    chip: "Top 10 count",
    type: "team",
    title: "Build your team",
    copy: "Start a team, invite friends, and climb together. Your top 10 count.",
  },
];

export default async function Landing() {
  const arena = await landingArena(publicV1Config(process.env));
  const hero = arena?.hero ?? "/demo/badmintonxp-arena-unbranded.jpg";
  const regionName = new Intl.DisplayNames(["en"], { type: "region" });
  const flag = (code: string) =>
    /^[A-Z]{2}$/.test(code)
      ? String.fromCodePoint(
          ...Array.from(code, (letter) => 127397 + letter.charCodeAt(0)),
        )
      : "🌍";
  return (
    <main className="launch-home">
      <section className="launch-hero" aria-labelledby="launch-title">
        <Image
          src={hero}
          alt=""
          fill
          unoptimized
          priority
          sizes="100vw"
          className="launch-art"
        />
        <div className="launch-intro">
          {arena && (
            <div className="launch-event-hud">
              <span className="launch-event-chip">
                {arena.live && <b>LIVE</b>}
                {arena.name}
                {arena.live ? ` · Day ${arena.day} of ${arena.totalDays}` : ""}
              </span>
              {arena.deadline && (
                <ChallengeClock
                  deadline={arena.deadline}
                  now={arena.now}
                  label={arena.timerLabel}
                />
              )}
            </div>
          )}
          <h1 id="launch-title">{headline}</h1>
          <p className="launch-description">{description}</p>
          <div
            className="launch-country-race"
            aria-label="Live country rankings"
          >
            {arena?.countries.length ? (
              <ol aria-label="Top countries">
                {arena.countries.map((country, index) => (
                  <li key={country.id}>
                    <span className="launch-country-flag" aria-hidden="true">
                      {flag(country.id)}
                    </span>
                    <span>
                      #{index + 1}{" "}
                      {(/^[A-Z]{2}$/.test(country.id)
                        ? regionName.of(country.id)
                        : country.name) ?? country.name}
                    </span>
                    <strong>{country.xp} XP</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <>
                <strong>Be the first from your country</strong>
                <span
                  className="launch-target-flags"
                  aria-label="Malaysia, Indonesia, India, Japan, South Korea and Denmark"
                >
                  {["MY", "ID", "IN", "JP", "KR", "DK"].map(flag).join(" ")}
                </span>
              </>
            )}
          </div>
          <GameButton
            tone="primary"
            className="launch-button"
            href="/play/account?mode=signup"
          >
            Register free
          </GameButton>
        </div>
      </section>
      <section className="launch-benefits" aria-label="Why play BadmintonXP">
        <ul className="launch-benefit-grid">
          {benefits.map(({ icon: Icon, chip, title, copy, type }) => (
            <li className="launch-benefit" data-panel={type} key={title}>
              <span className="launch-benefit-icon" aria-hidden="true">
                <Icon size={29} strokeWidth={2.3} />
              </span>
              <h2>{title}</h2>
              <p>{copy}</p>
              <span className="launch-benefit-chip">{chip}</span>
            </li>
          ))}
        </ul>
        <p className="launch-benefit-note">
          Free to play. Every tournament starts at 0.
        </p>
      </section>
      <section className="launch-how" aria-labelledby="launch-how-title">
        <h2 id="launch-how-title">How it plays</h2>
        <ol>
          {(
            [
              [Flag, "Pick your country"],
              [Zap, "Play daily"],
              [Trophy, "Climb the rankings"],
            ] as const
          ).map(([Icon, label], index) => (
            <li key={label}>
              <span>{index + 1}</span>
              <Icon size={24} aria-hidden="true" />
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      </section>
      <section
        className="launch-final"
        aria-label="World Tour Finals registration"
      >
        <h2>The World Tour Finals start 9 Dec. Get your spot.</h2>
        <GameButton
          tone="primary"
          className="launch-button"
          href="/play/account?mode=signup"
        >
          Register free
        </GameButton>
      </section>
    </main>
  );
}
