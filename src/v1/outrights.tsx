"use client";

import { useState } from "react";
import { GameButton } from "./game-button";
import { deadlineLabel } from "./game-ui";
import type { Outright } from "./types";

export const pickTime = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function outrightState(item: Outright, now: number) {
  if (item.voided_at) return "VOIDED";
  if (item.settled_at) return "SETTLED";
  if (Date.parse(item.closes_at) <= now) return "LOCKED";
  if (item.opens_at && Date.parse(item.opens_at) > now) return "OPENS";
  return "OPEN";
}

export function ChampionPicks({
  items,
  now,
  busy,
  save,
}: {
  items: Outright[];
  now: number;
  busy: boolean;
  save: (item: string, option: string) => Promise<void>;
}) {
  const [choice, setChoice] = useState<{ item: string; option: string } | null>(
    null,
  );
  if (!items.length) return null;
  return (
    <section className="champion-picks" aria-label="Pick your champion">
      <span className="eyebrow">PICK YOUR CHAMPION</span>
      <h1>Call the champion.</h1>
      {items.map((item) => {
        const state = outrightState(item, now);
        const picked = item.options.find(
          (option) => option.id === item.entry?.option_id,
        );
        const winner = item.options.find(
          (option) => option.id === item.winner_option_id,
        );
        const close = pickTime.format(new Date(item.closes_at));
        const seconds = Math.max(
          0,
          Math.ceil(
            (Date.parse(state === "OPENS" ? item.opens_at! : item.closes_at) -
              now) /
              1000,
          ),
        );
        return (
          <section
            className="panel champion-pick"
            data-panel="prediction"
            id={`outright-${item.id}`}
            key={item.id}
          >
            <div className="game-card-meta">
              <span className="eyebrow">{item.event_label}</span>
              <span className="game-status" data-state={state}>
                {state}
              </span>
            </div>
            <h2>{item.title}</h2>
            {(state === "OPEN" || state === "OPENS") && (
              <p>
                {deadlineLabel(seconds, state === "OPENS" ? "Opens" : "Closes")}
              </p>
            )}
            <p>
              Picks close <time dateTime={item.closes_at}>{close}</time>
            </p>
            <div className="champion-options">
              {item.options.map((option) => (
                <GameButton
                  key={option.id}
                  type="button"
                  aria-pressed={item.entry?.option_id === option.id}
                  disabled={busy || state !== "OPEN"}
                  onClick={() =>
                    setChoice({ item: item.id, option: option.id })
                  }
                >
                  {option.label}
                </GameButton>
              ))}
            </div>
            {choice?.item === item.id && state === "OPEN" && (
              <div
                className="reset-confirm"
                role="group"
                aria-label="Confirm champion pick"
              >
                <p>
                  Pick{" "}
                  {
                    item.options.find((option) => option.id === choice.option)
                      ?.label
                  }{" "}
                  as champion? You can change it until picks close.
                </p>
                <GameButton
                  type="button"
                  tone="primary"
                  disabled={busy}
                  onClick={async () => {
                    await save(item.id, choice.option);
                    setChoice(null);
                  }}
                >
                  Confirm pick
                </GameButton>
                <GameButton
                  type="button"
                  disabled={busy}
                  onClick={() => setChoice(null)}
                >
                  Keep choosing
                </GameButton>
              </div>
            )}
            <p role="status" data-testid="v1-outright-status">
              {state === "VOIDED"
                ? "This pick was voided. No XP awarded."
                : state === "SETTLED"
                  ? item.entry
                    ? item.entry.option_id === winner?.id
                      ? `Won · ${winner?.label} is champion! +20 XP`
                      : `Missed · ${winner?.label} is champion.`
                    : `${winner?.label} is champion. No pick this time.`
                  : state === "LOCKED"
                    ? picked
                      ? `Your pick: ${picked.label} is locked. Waiting for the champion.`
                      : "Picks are closed. No pick this time."
                    : picked
                      ? `Your pick: ${picked.label}. You can change it until ${close}.`
                      : "Pick the champion. A correct pick earns 20 XP."}
            </p>
          </section>
        );
      })}
    </section>
  );
}
