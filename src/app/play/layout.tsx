import type { Metadata, Viewport } from "next";
import { PwaProvider } from "@/pwa/client";
import "../demo/demo.css";
import "@/v1/v1.css";
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#06152c",
};
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BadmintonXP",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/icons/badmintonxp-apple.png" },
  title: "BadmintonXP · Fan arena",
  description:
    "Play quizzes, make free match predictions and rise with your team.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PwaProvider>{children}</PwaProvider>;
}
