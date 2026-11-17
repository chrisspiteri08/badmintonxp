import type { Metadata } from "next";
import { GameButton } from "@/v1/game-button";
import Image from "next/image";
import { landingHeroUrl } from "@/launch/hero";
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
    icon: "🌍",
    type: "rankings",
    title: "Play for your country",
    copy: "Every point you score lifts your nation in the live country rankings.",
  },
  {
    icon: "🎯",
    type: "prediction",
    title: "Call the big match",
    copy: "Predict one featured match a day. Get it right for +20 XP.",
  },
  {
    icon: "⚡",
    type: "quiz",
    title: "Daily badminton quiz",
    copy: "Quick questions every day of the tournament, easy to hard. +10 XP each.",
  },
  {
    icon: "👥",
    type: "team",
    title: "Build your team",
    copy: "Start a team, invite friends, and climb together. Your top 10 count.",
  },
];

export default async function Landing() {
  const hero = await landingHeroUrl(publicV1Config(process.env));
  return (
    <main className="launch-home">
      <section className="launch-hero" aria-labelledby="launch-title">
        {hero && (
          <Image
            src={hero}
            alt=""
            fill
            unoptimized
            priority
            sizes="100vw"
            className="launch-art"
          />
        )}
        <div className="launch-intro">
          <h1 id="launch-title">{headline}</h1>
          <p className="launch-description">{description}</p>
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
          {benefits.map(({ icon, title, copy, type }) => (
            <li className="launch-benefit" data-panel={type} key={title}>
              <span className="launch-benefit-icon" aria-hidden="true">
                {icon}
              </span>
              <h2>{title}</h2>
              <p>{copy}</p>
            </li>
          ))}
        </ul>
        <p className="launch-benefit-note">
          Free to play. Every tournament starts at 0.
        </p>
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
