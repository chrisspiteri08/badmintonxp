import type { Metadata } from "next";
import Link from "next/link";

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

export default function Landing() {
  return (
    <main className="launch-hero" aria-labelledby="launch-title">
      <div className="launch-intro">
        <h1 id="launch-title">{headline}</h1>
        <p className="launch-description">{description}</p>
        <Link className="launch-button" href="/play/account?mode=signup">
          Register free
        </Link>
      </div>
    </main>
  );
}
