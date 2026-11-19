"use client";

import { useState } from "react";
import type { Outright, Tournament } from "./types";
import { GameButton } from "./game-button";

export function ChampionResults({
  items,
  tournaments,
  now,
  busy,
  run,
}: {
  items: Outright[];
  tournaments: Tournament[];
  now: number;
  busy: boolean;
  run: (fn: string, args: Record<string, unknown>) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<{
    item: string;
    option: string | null;
  } | null>(null);
  return (
    <section
      className="panel v1-admin-section"
      aria-label="Enter champion results"
    >
      <h2>Enter champion results</h2>
      {items.length === 0 && <p>No champion picks yet.</p>}
      {items.map((item) => {
        const winner = item.options.find(
          (option) => option.id === item.winner_option_id,
        );
        return (
          <div className="v1-review" key={item.id}>
            <h3>{item.title}</h3>
            <p>
              {tournaments.find((t) => t.id === item.tournament_id)?.name} ·{" "}
              {item.pick_count ?? 0} picks
            </p>
            <p>Picks close {new Date(item.closes_at).toLocaleString()}</p>
            {item.voided_at ? (
              <p>Voided.</p>
            ) : item.settled_at ? (
              <p>Final: {winner?.label} is champion.</p>
            ) : (
              <div className="button-row">
                {item.options.map((option) => (
                  <GameButton
                    type="button"
                    key={option.id}
                    disabled={busy || Date.parse(item.closes_at) > now}
                    onClick={() =>
                      setConfirm({ item: item.id, option: option.id })
                    }
                  >
                    {option.label} wins
                  </GameButton>
                ))}
                <GameButton
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm({ item: item.id, option: null })}
                >
                  Void this pick
                </GameButton>
              </div>
            )}
            {confirm?.item === item.id &&
              !item.settled_at &&
              !item.voided_at && (
                <div
                  className="reset-confirm"
                  role="group"
                  aria-label="Confirm champion result"
                >
                  <p>
                    {confirm.option
                      ? `Confirm ${item.options.find((option) => option.id === confirm.option)?.label} as champion? This result is final and awards XP once.`
                      : "Void this pick? It will close without awarding XP."}
                  </p>
                  <GameButton
                    type="button"
                    tone="urgent"
                    disabled={busy}
                    onClick={async () => {
                      await run(
                        confirm.option
                          ? "v1_settle_outright"
                          : "v1_void_outright",
                        {
                          p_outright_id: item.id,
                          ...(confirm.option
                            ? { p_option_id: confirm.option }
                            : {}),
                        },
                      );
                      setConfirm(null);
                    }}
                  >
                    {confirm.option ? "Confirm champion" : "Confirm void"}
                  </GameButton>
                  <GameButton
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirm(null)}
                  >
                    Cancel
                  </GameButton>
                </div>
              )}
          </div>
        );
      })}
    </section>
  );
}
