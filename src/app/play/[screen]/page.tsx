import { notFound } from "next/navigation";
import { V1App } from "@/v1/app";
import type { Screen } from "@/v1/types";
const screens = [
  "account",
  "reset",
  "quiz",
  "predict",
  "standings",
  "profile",
  "admin",
];
export function generateStaticParams() {
  return screens.map((screen) => ({ screen }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!screens.includes(screen)) notFound();
  return <V1App screen={screen as Screen} />;
}
