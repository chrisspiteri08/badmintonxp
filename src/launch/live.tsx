"use client";
import Link from "next/link";

import { useEffect, useState, type FormEvent } from "react";

const launch = Date.parse("2026-12-09T00:00:00+08:00");

export function LaunchCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((launch - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);
  if (remaining === 0)
    return <p className="launch-date">Hangzhou launch countdown complete</p>;
  return (
    <div>
      <p className="launch-date">9 December 2026 · Hangzhou time</p>
      <div className="launch-clock" role="timer" aria-label="Time until launch">
        {[
          ["Days", 86400, 0],
          ["Hours", 3600, 24],
          ["Minutes", 60, 60],
          ["Seconds", 1, 60],
        ].map(([label, unit, cycle]) => {
          const value =
            remaining === null ? null : Math.floor(remaining / Number(unit));
          return (
            <div key={label}>
              <strong>
                {value === null
                  ? "–"
                  : String(cycle ? value % Number(cycle) : value).padStart(
                      2,
                      "0",
                    )}
              </strong>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WaitlistForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "idle") return;
    const data = new FormData(event.currentTarget);
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          consent: data.has("consent"),
          website: data.get("website"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error);
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("We couldn’t save your email. Please try again shortly.");
      setState("idle");
    }
  }
  if (state === "done")
    return (
      <p className="launch-success" role="status">
        You’re on the list! We’ll email you when BadmintonXP launches.
      </p>
    );
  return (
    <form className="launch-form" onSubmit={submit}>
      <label htmlFor="launch-email">Email address</label>
      <input
        id="launch-email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        placeholder="you@example.com"
        required
      />
      <label className="launch-trap" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="launch-consent">
        <input name="consent" type="checkbox" required />
        <span>
          I agree to receive BadmintonXP launch emails. Unsubscribe anytime.
        </span>
      </label>
      <Link className="launch-privacy" href="/privacy">
        Privacy policy
      </Link>
      {error && <p role="alert">{error}</p>}
      <button className="launch-button" disabled={state === "sending"}>
        {state === "sending" ? "Signing up…" : "Notify me"}
      </button>
    </form>
  );
}
