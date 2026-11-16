"use client";

import { useEffect, useState } from "react";

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
