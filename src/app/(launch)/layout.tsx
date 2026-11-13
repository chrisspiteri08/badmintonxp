import Link from "next/link";
import Image from "next/image";
import "../demo/demo.css";
import "@/v1/v1.css";
import "./launch.css";

export const metadata = { metadataBase: new URL("https://badmintonxp.com") };

export default function LaunchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="launch-site">
      <header className="launch-header">
        <Link href="/" className="launch-brand">
          <Image
            src="/demo/badmintonxp-crest-orange-transparent.png"
            width={34}
            height={42}
            alt=""
          />
          Badminton<span>XP</span>
        </Link>
        <Link className="launch-button launch-secondary" href="/#waitlist">
          Join waitlist
        </Link>
      </header>
      {children}
      <footer className="launch-footer">
        <nav aria-label="BadmintonXP information">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/about">About</Link>
        </nav>
        <nav aria-label="Social media">
          <a href="https://x.com/badmintonxpgame">X</a>
          <a href="https://instagram.com/badmintonxpgame">Instagram</a>
          <a href="https://facebook.com/badmintonxp">Facebook</a>
        </nav>
      </footer>
    </div>
  );
}
