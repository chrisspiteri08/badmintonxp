import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Users, Timer, Target, Medal } from "lucide-react";
import {
  LaunchCountdown,
  WaitlistForm,
  QuizPreview,
  StandingsPreview,
} from "@/launch/live";
import { XPProgress } from "@/v1/game-ui";

const title = "BadmintonXP | The badminton community game";
const dailyPlay =
  "Play a 15-second quiz and make a free match prediction every day of badminton's biggest tournaments.";
const progression =
  "Earn XP, rise from Rookie to Legend, and rep your country against fans across the world.";
const description = `${dailyPlay} ${progression}`;
export const metadata: Metadata = {
  metadataBase: new URL("https://badmintonxp.com"),
  title,
  description,
  openGraph: { title, description, url: "/", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function Landing() {
  return (
    <main>
      <section className="launch-hero" aria-labelledby="launch-title">
        <div className="launch-intro">
          <p className="launch-kicker">The badminton community game</p>
          <h1 id="launch-title">
            Predict. Quiz.
            <br />
            Earn XP for <em>your country.</em>
          </h1>
          <div className="launch-description">
            <p>{dailyPlay}</p>
            <p>{progression}</p>
          </div>
          <Link className="launch-button" href="#waitlist">
            <Users size={18} aria-hidden="true" /> Gather your team
          </Link>
          <div className="launch-timing">
            <Clock3 size={18} aria-hidden="true" />
            <LaunchCountdown />
          </div>
        </div>
        <QuizPreview />
      </section>
      <section className="launch-showcase" aria-labelledby="daily-title">
        <h2 id="daily-title">What happens every tournament day</h2>
        <div className="launch-daily-grid">
          <article>
            <Timer aria-hidden="true" />
            <h3>15s Daily Quiz</h3>
            <strong className="launch-chip">Up to 50 XP/day</strong>
            <p>
              Five questions a day, from easy to hard. You have 15 seconds per
              question, and your first tap locks your answer. Each correct
              answer earns 10 XP.
            </p>
          </article>
          <article>
            <Target aria-hidden="true" />
            <h3>Daily Match Call</h3>
            <strong className="launch-chip">+20 XP per call</strong>
            <p>
              Predict the winner of one featured tournament match each day. A
              correct call earns 20 XP.
            </p>
            <div className="launch-mini">
              <strong>Sample match call</strong>
              <div className="launch-match">
                <span>Ember</span>
                <b>vs</b>
                <span>Kite</span>
              </div>
              <small>Your pick locks before first serve.</small>
            </div>
          </article>
          <article>
            <Medal aria-hidden="true" />
            <h3>Rookie to Legend</h3>
            <strong className="launch-chip">250 XP per level</strong>
            <p>
              Go from Rookie to Pro to Legend. Build a daily streak by coming
              back each tournament day.
            </p>
            <div className="launch-mini demo v1">
              <span className="game-level">Rookie · Level 1</span>
              <div>160 XP</div>
              <XPProgress xp={160} label="Example level progress" />
            </div>
          </article>
        </div>
      </section>
      <section
        className="launch-showcase launch-team"
        aria-labelledby="team-title"
      >
        <h2 id="team-title">Never rise alone. Gather your team.</h2>
        <p>
          Pick your <strong>country</strong> and <strong>team</strong> before
          your first quiz or prediction in Hangzhou. Every point you score lifts
          all three rankings at once: <strong>Individuals</strong>,{" "}
          <strong>Teams</strong>, and <strong>Countries</strong>, for each event
          and the full season.
        </p>
        <StandingsPreview />
      </section>
      <section
        id="waitlist"
        className="launch-signup"
        aria-labelledby="launch-signup-title"
      >
        <h2 id="launch-signup-title">
          Get notified when we launch for Hangzhou
        </h2>
        <WaitlistForm />
      </section>
    </main>
  );
}
