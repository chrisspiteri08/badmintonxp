import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { publicV1Config } from "@/v1/config";

const windowMs = 60_000;
const attempts = new Map<string, { expires: number; count: number }>();
const submission = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  consent: z.literal(true),
  website: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  // Use the nearest proxy entry, since clients can prepend forwarded addresses.
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .at(-1)
    ?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const ip =
    [forwarded, realIp].find((value) => value && isIP(value)) ?? "unknown";
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.expires <= now) attempts.delete(key);
  }
  const entry = attempts.get(ip) ?? { expires: now + windowMs, count: 0 };
  if (entry.count >= 5 || (!attempts.has(ip) && attempts.size >= 10_000)) {
    return NextResponse.json(
      { error: "Please wait a minute and try again." },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      },
    );
  }
  entry.count++;
  attempts.set(ip, entry);

  const body = await request.json().catch(() => null);
  const result = submission.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Enter a valid email and agree to receive launch emails." },
      { status: 400 },
    );
  }
  if (result.data.website) return NextResponse.json({ ok: true });

  const config = publicV1Config(process.env);
  if (config.ready) {
    try {
      const response = await fetch(
        new URL("/rest/v1/waitlist_signups", config.url),
        {
          method: "POST",
          headers: {
            apikey: config.key,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ email: result.data.email }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (
        response.ok ||
        (response.status === 409 && (await response.json()).code === "23505")
      ) {
        return NextResponse.json({ ok: true });
      }
    } catch {
      // The client can retry when the service is available.
    }
  }
  return NextResponse.json(
    { error: "We couldn’t save your email. Please try again shortly." },
    { status: 503 },
  );
}
