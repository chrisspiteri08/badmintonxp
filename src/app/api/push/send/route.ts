import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendNotification } from "web-push";
import { allowedPushEndpoint, pushSettings } from "@/pwa/server";
import { publicV1Config } from "@/v1/config";
import type { Home } from "@/v1/types";

export const runtime = "nodejs";
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });
type Recipient = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function POST(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([\w.-]+)$/i)?.[1];
  if (!token) return fail("Sign in to send a reminder.", 401);
  const config = publicV1Config(process.env);
  if (!config.ready) return fail("Reminders are unavailable.", 503);
  const db = createClient(config.url, config.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: homeData, error: homeError } = await db.rpc("v1_home");
  if (homeError || !homeData?.admin)
    return fail("Owner admin access required.", 403);
  const vapidDetails = pushSettings();
  if (!vapidDetails) return fail("Reminders are not configured.", 503);
  const body = await request.json().catch(() => null);
  const home = homeData as Home;
  const now = Date.parse(home.server_now);
  let message;
  if (body?.kind === "quiz") {
    if (
      !home.quizzes.some(
        (quiz) =>
          Date.parse(quiz.opens_at) <= now && now < Date.parse(quiz.closes_at),
      )
    ) {
      return fail("Open a quiz before sending this reminder.", 409);
    }
    message = { title: "Today's quiz is live 🏸", url: "/play/quiz" };
  } else if (body?.kind === "match") {
    const match = home.matches.find(
      (item) =>
        !item.winner &&
        (!item.opens_at || Date.parse(item.opens_at) <= now) &&
        now < Date.parse(item.closes_at),
    );
    if (!match)
      return fail("Open a featured match before sending this reminder.", 409);
    message = {
      title: `Featured match: ${match.athlete_a} vs ${match.athlete_b} — make your pick`,
      url: "/play/predict",
    };
  } else {
    return fail("Choose a quiz or match reminder.", 400);
  }
  const payload = JSON.stringify(message);
  let after = "";
  let sent = 0;
  let expired = 0;
  let failed = 0;
  for (;;) {
    const { data, error } = await db.rpc("v1_push_recipients", {
      p_after: after,
    });
    if (error)
      return NextResponse.json(
        { error: "Couldn’t finish sending reminders.", sent, expired, failed },
        { status: 502 },
      );
    const recipients = data as Recipient[];
    if (!recipients.length) break;
    after = recipients[recipients.length - 1].endpoint;
    for (let index = 0; index < recipients.length; index += 10) {
      const stale: string[] = [];
      await Promise.all(
        recipients.slice(index, index + 10).map(async (recipient) => {
          if (!allowedPushEndpoint(recipient.endpoint)) {
            failed++;
            return;
          }
          try {
            await sendNotification(recipient, payload, {
              vapidDetails,
              TTL: 3600,
              timeout: 5000,
            });
            sent++;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410)
              stale.push(recipient.endpoint);
            else failed++;
          }
        }),
      );
      if (stale.length) {
        const { error: cleanupError } = await db.rpc("v1_push_recipients", {
          p_expired: stale,
        });
        if (cleanupError) failed += stale.length;
        else expired += stale.length;
      }
    }
  }
  return NextResponse.json({ sent, expired, failed });
}
