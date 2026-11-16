import { cache } from "react";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { publicV1Config } from "@/v1/config";
import type { TeamInvite } from "@/v1/fan-teams";
import { JoinTeam } from "./join-team";
import "../../demo/demo.css";
import "@/v1/v1.css";

type Props = { params: Promise<{ code: string }> };

const getInvite = cache(async (code: string): Promise<TeamInvite | null> => {
  if (!/^[a-f0-9]{12}$/i.test(code)) return null;
  const config = publicV1Config(process.env);
  if (!config.ready) return null;
  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .rpc("v1_team_invite", { p_code: code })
    .abortSignal(AbortSignal.timeout(3000));
  return error ? null : (data as TeamInvite | null);
});

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const team = await getInvite(code);
  const title = team
    ? `Join ${team.name} on BadmintonXP`
    : "Team invitation · BadmintonXP";
  const description =
    "Free badminton quizzes and predictions. Pick your country and play together.";
  const image = "/demo/badmintonxp-arena-unbranded.jpg";
  return {
    metadataBase: new URL("https://badmintonxp.com"),
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/join/${code}`,
      images: [{ url: image, alt: "BadmintonXP arena artwork" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function TeamInvitePage({ params }: Props) {
  const team = await getInvite((await params).code);
  return <JoinTeam team={team} />;
}
