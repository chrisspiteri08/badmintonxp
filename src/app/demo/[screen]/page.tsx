import { notFound } from "next/navigation";
import { DemoApp, type Screen } from "@/demo/app";
export function generateStaticParams() {
  return ["quiz", "prediction", "standings", "progress"].map((screen) => ({
    screen,
  }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!["quiz", "prediction", "standings", "progress"].includes(screen))
    notFound();
  return <DemoApp screen={screen as Screen} />;
}
