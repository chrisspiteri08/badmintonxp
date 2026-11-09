import { NextResponse } from "next/server";
import { publicV1Config } from "@/v1/config";
export const dynamic = "force-dynamic";
// Runtime-only; public URL/publishable key only. No service-role credential is needed by v1.
export async function GET() {
  return NextResponse.json(publicV1Config(process.env), {
    headers: { "Cache-Control": "no-store" },
  });
}
