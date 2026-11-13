"use client";
import Link from "next/link";
import { Copy, Trophy } from "lucide-react";
import { QuizAnswers, QuizTimer } from "@/v1/quiz-ui";

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
        {
          "You're in! 🏸 We'll email you before the first serve in Hangzhou. Warm up with us on X, Instagram and Facebook: @badmintonxpgame"
        }
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
          Yes, email me when BadmintonXP launches for Hangzhou, plus occasional
          game updates. Unsubscribe anytime. See our{" "}
          <Link className="launch-privacy" href="/privacy">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="launch-button" disabled={state === "sending"}>
        {state === "sending" ? "Signing up…" : "Notify me"}
      </button>
    </form>
  );
}

const previewOptions = ["12", "14", "16", "18"];

export function QuizPreview() {
  const [answer, setAnswer] = useState<number | null>(null);
  const correct = answer === 2;
  return (
    <div className="launch-preview">
      <div className="launch-phone demo v1">
        <div className="launch-camera" aria-hidden="true" />
        <p className="launch-kicker">Gameplay preview</p>
        <div className="panel quiz-panel">
          <div className="section-head">
            <span className="eyebrow">QUESTION 1 / 5</span>
            <QuizTimer remaining={12} />
          </div>
          <h2>How many feathers are on a shuttle?</h2>
          <QuizAnswers
            options={previewOptions}
            onAnswer={setAnswer}
            disabled={answer !== null}
          />
          {answer !== null && (
            <div
              className={`launch-quiz-result ${correct ? "launch-correct" : "launch-wrong"}`}
              role="status"
            >
              <strong>
                {correct ? "Clean winner · +10 XP" : "Not this rally · 0 XP"}
              </strong>
              <p>
                {correct
                  ? "16 goose or duck feathers on every tournament shuttle"
                  : "The right answer is 16."}
              </p>
              <Link href="#waitlist">
                Play the full 5-question round in Hangzhou
              </Link>
            </div>
          )}
        </div>
        <p className="launch-preview-status">Season opens 9 Dec · Hangzhou</p>
      </div>
    </div>
  );
}

const exampleRanks = {
  Individuals: ["ShuttleAce", "NetNinja", "RallyRider"],
  Teams: ["Neon Shuttles", "Court Crew", "Net Flyers"],
  Countries: ["Malaysia", "Indonesia", "Denmark"],
};

export function StandingsPreview() {
  const [league, setLeague] =
    useState<keyof typeof exampleRanks>("Individuals");
  const [inviteStatus, setInviteStatus] = useState("");
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText("https://badmintonxp.com/");
      setInviteStatus("Invite link copied!");
    } catch {
      setInviteStatus("Copy this link: https://badmintonxp.com/");
    }
  }
  return (
    <div className="launch-standings demo v1">
      <h3>Example standings</h3>
      <div
        className="launch-rank-tabs"
        role="group"
        aria-label="Ranking categories"
      >
        {(Object.keys(exampleRanks) as Array<keyof typeof exampleRanks>).map(
          (item) => (
            <button
              key={item}
              type="button"
              aria-pressed={league === item}
              onClick={() => setLeague(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <ol
        className="game-podium"
        aria-label={`Example ${league.toLowerCase()} podium`}
      >
        {exampleRanks[league].map((name, index) => (
          <li key={name} data-place={index + 1}>
            <Trophy size={23} aria-hidden="true" />
            <span>#{index + 1}</span>
            <strong>{name}</strong>
            <small>{[120, 100, 80][index]} XP</small>
          </li>
        ))}
      </ol>
      <p>Invite your badminton group to join the waitlist.</p>
      <button className="launch-button" type="button" onClick={copyInvite}>
        <Copy size={16} aria-hidden="true" /> Copy invite link
      </button>
      {inviteStatus && <p role="status">{inviteStatus}</p>}
    </div>
  );
}
