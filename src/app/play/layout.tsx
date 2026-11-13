import type { Viewport } from "next";
import "../demo/demo.css";
import "@/v1/v1.css";
export const viewport: Viewport = { viewportFit: "cover" };
export const metadata = {
  title: "BadmintonXP · Fan arena",
  description:
    "Play quizzes, make free match predictions and rise with your team.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
