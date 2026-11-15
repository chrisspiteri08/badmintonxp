import { NextResponse } from "next/server";
import { pushSettings } from "@/pwa/server";

export const dynamic = "force-dynamic";
export function GET() {
  const config = pushSettings();
  return NextResponse.json(
    { publicKey: config?.publicKey ?? null },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
