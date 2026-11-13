import type { Metadata } from "next";
import { notFound } from "next/navigation";

const pages = {
  privacy: "Privacy",
  terms: "Terms",
  about: "About",
} as const;
type Params = Promise<{ document: string }>;
const contact = (
  <a href="mailto:admin@badmintonxp.com">admin@badmintonxp.com</a>
);

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(pages).map((document) => ({ document }));
}
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { document } = await params;
  return {
    title: `${pages[document as keyof typeof pages] ?? "Page"} | BadmintonXP`,
  };
}

export default async function PolicyPage({ params }: { params: Params }) {
  const { document } = await params;
  if (!Object.hasOwn(pages, document)) notFound();
  return (
    <main className="launch-document">
      <p className="launch-kicker">Draft for review</p>
      <h1>{pages[document as keyof typeof pages]}</h1>
      {document === "privacy" ? (
        <>
          <h2>What we collect</h2>
          <p>
            We collect your email and consent when you join the launch list,
            account data such as your email, username, country and team when you
            register, and gameplay data such as quiz answers, predictions and
            XP.
          </p>
          <h2>How we use it</h2>
          <p>
            We use launch sign-ups to send launch emails. We use account and
            gameplay data to run the game, save progress and show standings.
            Supabase processes data for us through its database and
            authentication services. We do not sell your data.
          </p>
          <h2>Your choices</h2>
          <p>
            Use the unsubscribe link in a launch email or email {contact} to
            unsubscribe or request deletion of your waitlist or account data.
          </p>
        </>
      ) : document === "terms" ? (
        <>
          <h2>Playing BadmintonXP</h2>
          <p>
            BadmintonXP is a free fan game. Use your own account, keep your
            login details secure and play fairly. Match predictions are part of
            the game. Tournament content and game availability may change.
          </p>
          <h2>Questions</h2>
          <p>Contact {contact} about these terms.</p>
        </>
      ) : (
        <>
          <h2>The badminton community game</h2>
          <p>
            BadmintonXP is an independent fan game for people who follow
            badminton. Play timed quizzes, make free match predictions and earn
            XP for yourself, your team and your country.
          </p>
          <p>Contact {contact} to get in touch.</p>
        </>
      )}
    </main>
  );
}
