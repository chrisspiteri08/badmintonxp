"use client";

import { useEffect, useState } from "react";

export function ChallengeClock({
  deadline,
  now,
  label,
}: {
  deadline: number;
  now: number;
  label: string;
}) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.ceil((deadline - now) / 1000)),
  );
  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => {
      setSeconds(
        Math.max(
          0,
          Math.ceil((deadline - now - (performance.now() - started)) / 1000),
        ),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, now]);
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return (
    <p className="launch-challenge-clock">
      <span>{seconds ? label : "Check the arena for the next challenge"}</span>
      {seconds > 0 && (
        <strong role="timer">
          {hours ? `${hours}:` : ""}
          {minutes}:{remainder}
        </strong>
      )}
    </p>
  );
}
