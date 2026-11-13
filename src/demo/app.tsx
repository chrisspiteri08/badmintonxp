"use client";
/* Artwork: approved handoff assets. Canvas reference informed composition, not scoring. */
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useDemo } from "./store";
import { closesIn, predictionResult } from "./prediction-copy";
import {
  demoNow,
  earnedXP,
  guestXP,
  totals,
  PEOPLE,
  QUESTIONS,
  RULES,
  type League,
  type Scope,
} from "./model";
export type Screen = "arena" | "quiz" | "prediction" | "standings" | "progress";
const nav = [
  { screen: "arena", name: "Arena", href: "/demo" },
  { screen: "quiz", name: "Play", href: "/demo/quiz" },
  { screen: "prediction", name: "Predict", href: "/demo/prediction" },
  { screen: "standings", name: "Rankings", href: "/demo/standings" },
  { screen: "progress", name: "My XP", href: "/demo/progress" },
];
export function DemoApp({ screen }: { screen: Screen }) {
  const { state, error, dispatch, reset } = useDemo();
  const [scope, setScope] = useState<Scope>("event");
  const [league, setLeague] = useState<League>("players");
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingPick, setPendingPick] = useState<"Ember" | "Kite" | null>(null);
  const action = async (a: Parameters<typeof dispatch>[0]) => {
    await dispatch(a);
  };
  if (!state)
    return (
      <main className="demo loading">
        <h1>Opening your arena…</h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void reset()}>Full demo reset</button>
          </>
        )}
      </main>
    );
  const xp = guestXP(state),
    gain = earnedXP(state),
    now = demoNow(state, Date.now());
  const rows = totals(state, scope, league),
    eventRows = totals(state, "event", "players");
  const own = rows.find((r) => r.you)!;
  const eventOwn = eventRows.find((r) => r.you)!;
  const teamEvent = totals(state, "event", "teams").find((r) => r.you)!;
  const level = Math.floor(xp / 250) + 1;
  const levelXP = xp % 250;
  const attempt = state.attempt;
  const complete = !!attempt?.complete;
  const feedback = !!attempt?.awaitingNext;
  const index = attempt
    ? Math.min(attempt.answers.length, QUESTIONS.length - 1)
    : 0;
  const question = QUESTIONS[index];
  const lastIndex = Math.max(0, (attempt?.answers.length || 0) - 1);
  const last = attempt?.answers[lastIndex];
  const quizScore = attempt?.answers.reduce((sum, a) => sum + a.xp, 0) || 0;
  const closed = now >= state.predictionDeadline;
  const remaining = attempt
    ? Math.max(0, Math.ceil((attempt.deadline - now) / 1000))
    : 15;
  return (
    <div className="demo">
      <a className="skip" href="#demo-content">
        Skip to content
      </a>
      <header className="demo-header">
        <Link href="/demo" className="brand" aria-label="BadmintonXP arena">
          <Image
            unoptimized
            width={720}
            height={1280}
            src="/demo/badmintonxp-crest-orange-transparent.png"
            alt=""
          />
          <span>
            BADMINTON<span>XP</span>
            <small className="demo-badge">Fictional demo</small>
          </span>
        </Link>
        <Link
          className="xp-chip"
          href="/demo/progress"
          aria-label={`Lifetime demo XP: ${xp}`}
        >
          <strong data-testid="lifetime-xp">{xp} XP</strong>
          <small>Lifetime XP</small>
        </Link>
      </header>
      <nav className="demo-nav" aria-label="Guest demo">
        {nav.map((n) => (
          <Link
            key={n.screen}
            href={n.href}
            aria-current={screen === n.screen ? "page" : undefined}
          >
            {n.name}
          </Link>
        ))}
      </nav>
      <main id="demo-content" tabIndex={-1}>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {screen === "arena" ? (
          <>
            <section className="hero" aria-labelledby="event-title">
              <Image
                unoptimized
                width={720}
                height={1280}
                priority
                className="hero-art"
                src="/demo/badmintonxp-arena-unbranded.jpg"
                alt="Illustrated badminton athletes playing in a dramatic floodlit arena"
              />
              <div className="hero-top">
                <span className="eyebrow">CURRENT EVENT / 01</span>
                <h1 id="event-title">
                  BIRMINGHAM
                  <br />
                  <span>DEMO CUP</span>
                </h1>
                <p>
                  Your knowledge. <br />
                  Your people.
                </p>
              </div>
              <div className="hero-bottom">
                <span className="live-label">● YOUR NEXT RALLY</span>
                <h2>Every rally counts.</h2>
                <p>
                  Neon Shuttles <span> / </span> Supporting Malaysia
                </p>
              </div>
            </section>
            <section className="level-card" aria-label="Your level progress">
              <div>
                <span>LEVEL {level}</span>
                <strong>
                  {levelXP} <small>/ 250 XP</small>
                </strong>
              </div>
              <div
                className="level-track"
                role="progressbar"
                aria-label={`Level ${level} progress`}
                aria-valuenow={levelXP}
                aria-valuemin={0}
                aria-valuemax={250}
              >
                <span style={{ width: `${(levelXP / 250) * 100}%` }} />
              </div>
              <small>
                {250 - levelXP} XP to level {level + 1}
              </small>
            </section>
            <div className="arena-grid">
              <section className="play-cards" aria-label="Play challenges">
                <Link className="action-card primary" href="/demo/quiz">
                  <span>
                    <small>15 SECONDS. ONE SHOT.</small>
                    <strong>
                      {complete
                        ? "QUIZ RESULTS"
                        : attempt
                          ? "RESUME QUIZ"
                          : "PLAY QUIZ"}
                    </strong>
                    <span>
                      {complete
                        ? `Scored ${quizScore} XP`
                        : "Test your badminton IQ · up to 30 XP"}
                    </span>
                  </span>
                  <b aria-hidden="true">↗</b>
                </Link>
                <Link className="action-card" href="/demo/prediction">
                  <span>
                    <small>EMBER vs KITE</small>
                    <strong>MAKE YOUR CALL</strong>
                    <span>
                      {state.settled
                        ? predictionResult(
                            state.entry?.option ?? null,
                            RULES.predictionXP,
                          )
                        : state.entry
                          ? "Your entry is locked"
                          : "Free prediction · 20 XP for a correct call"}
                    </span>
                  </span>
                  <b aria-hidden="true">↗</b>
                </Link>
                <div className="team-banner">
                  <Image
                    unoptimized
                    width={720}
                    height={1280}
                    src="/demo/badmintonxp-crest-orange-transparent.png"
                    alt=""
                  />
                  <div>
                    <small>YOUR PEOPLE</small>
                    <strong>NEON SHUTTLES</strong>
                    <span>
                      Malaysia ·{" "}
                      <b data-testid="team-event-rank">
                        Event rank #{teamEvent.rank}
                      </b>
                    </span>
                  </div>
                  <Link
                    href="/demo/standings"
                    aria-label="View team and country standings"
                  >
                    →
                  </Link>
                </div>
              </section>
              <section className="panel home-standings">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">THE CHASE IS ON</span>
                    <h2>Event front-runners</h2>
                  </div>
                  <Link href="/demo/standings">Full table ↗</Link>
                </div>
                <ol className="rank-list" data-testid="home-top-three">
                  {eventRows.slice(0, 3).map((r) => (
                    <li key={r.id} className={r.you ? "you" : ""}>
                      <strong>#{r.rank}</strong>
                      <span>
                        {r.name}
                        {r.you && " · You"}
                      </span>
                      <b>
                        {r.xp} <small>XP</small>
                      </b>
                    </li>
                  ))}
                </ol>
                <div className="own-rank" data-testid="home-own-rank">
                  <span>
                    Your event position <strong>#{eventOwn.rank}</strong>
                  </span>
                  <b>{eventOwn.xp} XP</b>
                </div>
                <p className="muted">
                  Your latest gains: <strong>+{gain} XP</strong>.
                </p>
              </section>
            </div>
          </>
        ) : (
          <>
            <div className="event-strip">
              <Image
                unoptimized
                width={720}
                height={1280}
                src="/demo/birmingham-demo-montage-clean.png"
                alt="Imaginative illustrated city and badminton arena montage"
              />
              <div>
                <span className="eyebrow">CURRENT EVENT</span>
                <strong>BIRMINGHAM DEMO CUP</strong>
                <span>
                  New gains +{gain} XP · Lifetime {xp} XP
                </span>
              </div>
            </div>
            {screen === "quiz" && (
              <section className="challenge-section">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">SHUTTLE IQ / 01</span>
                    <h1>
                      Know the game.
                      <br />
                      <span>Own the rally.</span>
                    </h1>
                  </div>
                  <span className="round-mark">QUIZ</span>
                </div>
                <div className="panel quiz-panel">
                  {!attempt ? (
                    <>
                      <span className="eyebrow">3 QUESTIONS · UP TO 30 XP</span>
                      <h2>Ready for your first rally?</h2>
                      <p>
                        Three questions. 15 seconds each. Tap once to lock your
                        answer. Earn 10 XP for every correct call.
                      </p>
                      <p className="muted">
                        Keep your eye on the clock — it keeps running if you
                        leave.
                      </p>
                      <button
                        className="primary wide"
                        onClick={() => void action({ type: "start" })}
                      >
                        Start quiz →
                      </button>
                    </>
                  ) : complete ? (
                    <div className="quiz-result" role="status">
                      <span className="eyebrow">RALLY COMPLETE</span>
                      <h2>That’s your rally.</h2>
                      <strong
                        className="big-xp xp-pop"
                        data-testid="quiz-score"
                      >
                        +{quizScore} XP
                      </strong>
                      <p>Nice rally. Here’s how you played.</p>
                      <ol className="answer-review">
                        {attempt.answers.map((a, i) => (
                          <li key={i}>
                            <strong>
                              Q{i + 1} ·{" "}
                              {a.option === null
                                ? "Timed out"
                                : a.xp
                                  ? "Correct"
                                  : "Incorrect"}{" "}
                              · {a.xp} XP
                            </strong>
                            <span>{QUESTIONS[i].explanation}</span>
                          </li>
                        ))}
                      </ol>
                      <Link className="button primary" href="/demo/prediction">
                        Make your match call →
                      </Link>
                    </div>
                  ) : feedback && last ? (
                    <div
                      key={lastIndex}
                      role="status"
                      className={`answer-reveal ${last.xp ? "is-correct" : "is-wrong"}`}
                    >
                      <span className="reveal-icon" aria-hidden="true">
                        {last.xp ? "✓" : "×"}
                      </span>
                      <span className="eyebrow">
                        QUESTION {lastIndex + 1} / 3 · ANSWER LOCKED
                      </span>
                      <h2>
                        {last.xp
                          ? "Clean winner."
                          : "Keep your head in the game."}
                      </h2>
                      <span className="reveal-label">
                        {last.xp ? "CORRECT ANSWER" : "WRONG ANSWER"}
                      </span>
                      <strong className="big-xp xp-pop">+{last.xp} XP</strong>
                      <div className="reveal-options">
                        {QUESTIONS[lastIndex].options.map((option, i) => (
                          <div
                            key={option}
                            className={
                              i === QUESTIONS[lastIndex].correct
                                ? "correct-option"
                                : i === last.option
                                  ? "wrong-option"
                                  : ""
                            }
                          >
                            <span>{option}</span>
                            <strong>
                              {i === QUESTIONS[lastIndex].correct
                                ? "✓ Correct"
                                : i === last.option
                                  ? "× Your pick"
                                  : ""}
                            </strong>
                          </div>
                        ))}
                      </div>
                      <p>{QUESTIONS[lastIndex].explanation}</p>
                      <p>Attempt score so far: {quizScore} XP</p>
                      <button
                        className="primary wide"
                        onClick={() => void action({ type: "next" })}
                      >
                        Next question →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="section-head">
                        <span className="eyebrow">
                          QUESTION {index + 1} / 3
                        </span>
                        <strong
                          className={`timer ${remaining <= 5 ? "urgent" : ""}`}
                          role="timer"
                          aria-label={`${remaining} seconds remaining`}
                          data-testid="quiz-timer"
                        >
                          <svg viewBox="0 0 80 80" aria-hidden="true">
                            <circle
                              className="countdown-track"
                              cx="40"
                              cy="40"
                              r="34"
                            />
                            <circle
                              className="countdown-arc"
                              cx="40"
                              cy="40"
                              r="34"
                              pathLength="100"
                              strokeDasharray="100"
                              strokeDashoffset={100 - (remaining / 15) * 100}
                            />
                          </svg>
                          <span>{remaining}s</span>
                        </strong>
                      </div>

                      <h2 data-testid="quiz-question">{question.text}</h2>
                      <div className="answer-grid">
                        {question.options.map((option, i) => (
                          <button
                            key={option}
                            onClick={() =>
                              void action({ type: "answer", index, option: i })
                            }
                          >
                            <span>{String.fromCharCode(65 + i)}</span>
                            {option}
                          </button>
                        ))}
                      </div>
                      <p className="muted">First tap. Final answer.</p>
                      <span className="score-line">
                        YOUR SCORE <strong>{quizScore} XP</strong>
                      </span>
                    </>
                  )}
                </div>
              </section>
            )}
            {screen === "prediction" && (
              <section className="challenge-section">
                <span className="eyebrow">THE MATCH CALL / 02</span>
                <h1>Back your instinct.</h1>
                <div className="panel">
                  <div className="section-head">
                    <span className="pill">
                      {state.settled
                        ? "MATCH FINISHED"
                        : state.entry
                          ? "ENTRY LOCKED · PENDING"
                          : closed
                            ? "ENTRIES CLOSED"
                            : "ENTRIES OPEN"}
                    </span>
                    <span className="muted">20 XP to win</span>
                  </div>
                  <h2>Who takes the win?</h2>
                  <p>Singles exhibition · Ember vs Kite</p>
                  <div className="fixture-art" aria-hidden="true">
                    <Image
                      unoptimized
                      width={720}
                      height={1280}
                      src="/demo/badmintonxp-arena-unbranded.jpg"
                      alt=""
                    />
                    <strong>
                      EMBER <span>VS</span> KITE
                    </strong>
                  </div>
                  <p className="deadline" data-testid="prediction-countdown">
                    <strong>{closesIn(state.predictionDeadline, now)}</strong>
                  </p>
                  <div className="answer-grid prediction-grid">
                    {(["Ember", "Kite"] as const).map((name, i) => (
                      <button
                        key={name}
                        disabled={!!state.entry || closed || state.settled}
                        aria-pressed={state.entry?.option === name}
                        onClick={() => setPendingPick(name)}
                      >
                        <span className="athlete-number">0{i + 1}</span>
                        <strong>{name}</strong>
                        <small>
                          {state.entry?.option === name
                            ? "YOUR LOCKED PICK ✓"
                            : state.entry
                              ? "Not picked"
                              : "MAKE YOUR CALL"}
                        </small>
                      </button>
                    ))}
                  </div>
                  {pendingPick && !state.entry && !closed && !state.settled && (
                    <div
                      className="reset-confirm"
                      role="group"
                      aria-label="Confirm prediction"
                    >
                      <p>
                        Lock {pendingPick} as your pick? You can’t change it
                        once locked.
                      </p>
                      <div className="button-row">
                        <button
                          className="primary"
                          onClick={async () => {
                            await action({
                              type: "predict",
                              option: pendingPick,
                            });
                            setPendingPick(null);
                          }}
                        >
                          Lock {pendingPick}
                        </button>
                        <button autoFocus onClick={() => setPendingPick(null)}>
                          Keep choosing
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="muted">
                    Pick once. A correct call earns 20 XP.
                  </p>
                  <div
                    role="status"
                    data-testid="prediction-status"
                    className="prediction-status"
                  >
                    {state.settled
                      ? predictionResult(
                          state.entry?.option ?? null,
                          RULES.predictionXP,
                        )
                      : state.entry
                        ? `Pending · Your ${state.entry.option} entry is locked.`
                        : closed
                          ? "Entries closed. No guest entry."
                          : "Choose an athlete to lock your pick."}
                  </div>
                  <details className="simulation" open={!!state.entry}>
                    <summary>Demo: settle result</summary>
                    <p>
                      Fast-forward to the final whistle, then reveal the winner.
                      Any quiz in progress will run down too.
                    </p>
                    <div className="button-row">
                      <button
                        disabled={closed}
                        onClick={() => void action({ type: "close" })}
                      >
                        Fast-forward to match end
                      </button>
                      <button
                        className="primary"
                        disabled={!closed || state.settled}
                        onClick={() => void action({ type: "settle" })}
                      >
                        Reveal winner
                      </button>
                    </div>
                  </details>
                </div>
              </section>
            )}
            {screen === "standings" && (
              <section className="standings-section">
                <span className="eyebrow">FRIENDLY RIVALRY</span>
                <h1>Never rise alone.</h1>
                <div className="filter-row" aria-label="Standings period">
                  {(["event", "season"] as const).map((s) => (
                    <button
                      key={s}
                      aria-pressed={scope === s}
                      onClick={() => setScope(s)}
                    >
                      {s === "event" ? "Current event" : "Season"}
                    </button>
                  ))}
                </div>
                <p className="muted">
                  {scope === "event"
                    ? "Birmingham Demo Cup"
                    : "Harbour Cup + Birmingham Demo Cup"}
                </p>
                <div
                  className="filter-row leagues"
                  aria-label="Standings group"
                >
                  {(["players", "teams", "countries"] as const).map((l) => (
                    <button
                      key={l}
                      aria-pressed={league === l}
                      onClick={() => setLeague(l)}
                    >
                      {l === "players"
                        ? "Individuals"
                        : l === "teams"
                          ? "Teams"
                          : "Countries"}
                    </button>
                  ))}
                </div>
                <div className="standing-summary">
                  <div>
                    <small>
                      YOUR{" "}
                      {league === "players" ? "POSITION" : "SIDE’S POSITION"}
                    </small>
                    <strong data-testid="standings-own-rank">
                      #{own.rank}
                    </strong>
                  </div>
                  <div>
                    <strong data-testid="standings-own-xp">{own.xp} XP</strong>
                    <small>
                      {scope === "event" ? "EVENT" : "SEASON"} TOTAL
                    </small>
                  </div>
                </div>
                <div className="table-wrap">
                  <table data-testid="standings-table">
                    <caption>
                      {scope === "event"
                        ? "Birmingham Demo Cup"
                        : "Demo season"}{" "}
                      ·{" "}
                      {league === "players"
                        ? "Individual rankings"
                        : league === "teams"
                          ? "Team rankings"
                          : "Country rankings"}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">
                          {league === "players"
                            ? "Player"
                            : league === "teams"
                              ? "Team"
                              : "Country"}
                        </th>
                        <th scope="col">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className={r.you ? "you" : ""}>
                          <td>#{r.rank}</td>
                          <th scope="row">
                            {r.name}
                            {r.you && (
                              <small>
                                {" "}
                                YOUR {league === "players" ? "GUEST" : "SIDE"}
                              </small>
                            )}
                          </th>
                          <td>{r.xp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {screen === "progress" && (
              <section className="progress-section">
                <span className="eyebrow">YOUR IMPACT / RALLY ROOKIE</span>
                <h1>
                  Small plays.
                  <br />
                  <span>Shared pride.</span>
                </h1>
                <div className="panel">
                  <span className="eyebrow">YOUR LATEST GAINS</span>
                  <strong className="big-xp">+{gain} XP</strong>
                  <p>
                    Lifetime: <strong>{xp} XP</strong> · Current event:{" "}
                    <strong>{eventOwn.xp} XP</strong> · Event rank:{" "}
                    <strong>#{eventOwn.rank}</strong>
                  </p>
                  <p>
                    Team: {PEOPLE[0].team} · Country: {PEOPLE[0].country}
                  </p>
                  <p className="muted">
                    Every point lifts your team and country too.
                  </p>
                  <div className="progress-line">
                    <span>Shuttle IQ</span>
                    <strong>
                      {complete
                        ? `Complete · ${quizScore} XP`
                        : attempt
                          ? "In progress"
                          : "Not started"}
                    </strong>
                  </div>
                  <div className="progress-line">
                    <span>Match call</span>
                    <strong>
                      {state.settled
                        ? "Match finished"
                        : state.entry
                          ? "Locked · pending"
                          : "Not entered"}
                    </strong>
                  </div>
                  <div className="button-row">
                    <Link className="button primary" href="/demo/quiz">
                      {complete ? "Review quiz" : "Play quiz"} →
                    </Link>
                    <Link className="button" href="/demo/standings">
                      See the ripple →
                    </Link>
                  </div>
                </div>
                <details className="ledger">
                  <summary>XP history</summary>
                  <ul>
                    {state.ledger
                      .filter((a) => a.user === "guest")
                      .map((a) => (
                        <li key={a.id}>
                          {a.challenge === "shuttle-iq"
                            ? "Shuttle IQ"
                            : a.challenge === "ember-kite"
                              ? "Match call"
                              : "Earlier rallies"}{" "}
                          <strong>+{a.xp} XP</strong>
                        </li>
                      ))}
                  </ul>
                </details>
              </section>
            )}
          </>
        )}
      </main>
      <footer>
        <p>Independent fan game. No live results or real prizes.</p>
        <button className="text-button" onClick={() => setConfirmReset(true)}>
          Full demo reset
        </button>
        {confirmReset && (
          <div
            className="reset-confirm"
            role="group"
            aria-label="Confirm full reset"
          >
            <p>
              Clear all guest progress, picks and awards? This is the only way
              to replay for XP.
            </p>
            <div className="button-row">
              <button
                className="primary"
                onClick={async () => {
                  await reset();
                  setConfirmReset(false);
                }}
              >
                Confirm full reset
              </button>
              <button autoFocus onClick={() => setConfirmReset(false)}>
                Keep my progress
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
