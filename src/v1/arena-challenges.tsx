import Link from "next/link";
import { Check, Clock3, Play, Target } from "lucide-react";
import { deadlineLabel } from "./game-ui";
import type { Home } from "./types";

const opensAt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function ArenaChallenges({
  home,
  now,
  signedIn,
}: {
  home: Home;
  now: number;
  signedIn: boolean;
}) {
  const quizzes = home.quizzes.map((quiz) => {
    const opens = Date.parse(quiz.opens_at);
    const closes = Date.parse(quiz.closes_at);
    const done =
      Boolean(quiz.attempt?.complete) || (closes <= now && !quiz.attempt);
    return {
      id: quiz.id,
      name: quiz.title,
      kind: "Quiz",
      url: `/play/quiz?quiz=${encodeURIComponent(quiz.id)}`,
      action: quiz.attempt ? "Continue quiz" : "Play now",
      opens,
      closes,
      state: done ? 2 : opens > now ? 1 : 0,
      result: quiz.attempt?.complete ? `+${quiz.attempt.score} XP` : "Missed",
    };
  });
  const matches = home.matches.map((match) => {
    const closes = Date.parse(match.closes_at);
    const opens = match.opens_at ? Date.parse(match.opens_at) : 0;
    const done = Boolean(match.entry || match.winner || closes <= now);
    return {
      id: match.id,
      name: `${match.athlete_a} vs ${match.athlete_b}`,
      kind: "Prediction",
      url: `/play/predict?match=${encodeURIComponent(match.id)}`,
      action: "Predict",
      opens,
      closes,
      state: done ? 2 : opens > now ? 1 : 0,
      result: match.entry
        ? match.winner
          ? `+${match.entry.pick === match.winner ? 20 : 0} XP`
          : "Pick locked · awaiting result"
        : "Missed",
    };
  });
  const challenges = [...quizzes, ...matches].sort(
    (a, b) =>
      a.state - b.state ||
      (a.state === 0
        ? a.closes - b.closes
        : a.state === 1
          ? a.opens - b.opens
          : b.closes - a.closes),
  );
  return (
    <section
      className="arena-challenges"
      aria-labelledby="arena-challenges-title"
    >
      <h2 id="arena-challenges-title">Tournament challenges</h2>
      {challenges.length ? (
        <ul className="arena-challenge-list">
          {challenges.map((item) => {
            const Icon = item.kind === "Quiz" ? Play : Target;
            const seconds = Math.max(0, Math.ceil((item.closes - now) / 1000));
            return (
              <li
                key={item.id}
                className="panel arena-challenge"
                data-state={["open", "upcoming", "done"][item.state]}
              >
                <Icon size={22} aria-hidden="true" />
                <div>
                  <span className="eyebrow">{item.kind}</span>
                  <h3>{item.name}</h3>
                  <p>
                    {item.state === 0 ? (
                      seconds ? (
                        deadlineLabel(seconds)
                      ) : (
                        "Quiz in progress"
                      )
                    ) : item.state === 1 ? (
                      `Opens ${opensAt.format(item.opens)} UTC`
                    ) : item.result.startsWith("+") ? (
                      <>
                        <Check size={16} aria-hidden="true" /> {item.result}
                      </>
                    ) : (
                      item.result
                    )}
                  </p>
                </div>
                {item.state === 0 && (
                  <Link
                    className="button primary"
                    href={signedIn ? item.url : "/play/account"}
                  >
                    {item.action}
                  </Link>
                )}
                {item.state === 1 && <Clock3 size={18} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Challenges will appear when the tournament schedule is ready.</p>
      )}
    </section>
  );
}
