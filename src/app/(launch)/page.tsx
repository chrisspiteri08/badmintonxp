import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, Play } from "lucide-react";
import { LaunchCountdown, WaitlistForm } from "@/launch/live";
import { QuizAnswers, QuizTimer } from "@/v1/quiz-ui";

const title = "BadmintonXP | The badminton community game";
const description =
  "Play 15-second quizzes, make free match predictions and earn XP for your country. Get notified about the Hangzhou launch.";
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
          <p className="launch-description">
            Play 15-second quizzes, make free match predictions and earn XP for
            the individual, team and country leaderboards.
          </p>
          <Link className="launch-button" href="/play">
            <Play size={17} fill="currentColor" aria-hidden="true" /> Play now
          </Link>
          <div className="launch-timing">
            <Clock3 size={18} aria-hidden="true" />
            <LaunchCountdown />
          </div>
        </div>
        <div className="launch-preview">
          <div className="launch-phone demo v1">
            <div className="launch-camera" aria-hidden="true" />
            <p className="launch-kicker">Gameplay preview</p>
            <div className="panel quiz-panel">
              <div className="section-head">
                <span className="eyebrow">QUESTION 1 / 3</span>
                <QuizTimer remaining={12} />
              </div>
              <h2>How many feathers are on a shuttle?</h2>
              <QuizAnswers options={["12", "14", "16", "18"]} />
            </div>
            <Link className="launch-preview-link" href="/play/quiz">
              Play a quiz <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section className="launch-signup" aria-labelledby="launch-signup-title">
        <h2 id="launch-signup-title">
          Get notified when we launch for Hangzhou
        </h2>
        <WaitlistForm />
      </section>
    </main>
  );
}
