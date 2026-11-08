import { DemoProvider } from "@/demo/store";
import "./demo.css";
export const metadata = { title: "BadmintonXP · Guest arena" };
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoProvider>{children}</DemoProvider>;
}
