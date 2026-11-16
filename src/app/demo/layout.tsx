import type { Metadata } from "next";
import { DemoProvider } from "@/demo/store";
import "./demo.css";
export const metadata: Metadata = {
  title: "BadmintonXP · Guest arena",
  robots: { index: false },
};
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoProvider>{children}</DemoProvider>;
}
