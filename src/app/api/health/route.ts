import { NextResponse } from "next/server";
import { publicV1Config } from "@/v1/config";
import { databaseConnected } from "@/v1/health";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const connected = await databaseConnected(publicV1Config(process.env));
  return NextResponse.json(
    { databaseConnected: connected },
    {
      status: connected ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
