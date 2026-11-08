import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BadmintonXP · The fan arena",
  description: "An independent, fictional badminton fan-game demo.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
