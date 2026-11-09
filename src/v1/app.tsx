"use client";
import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { friendlyError, v1Client } from "./client";
import type { Attempt, Home, Match, Rank, Screen } from "./types";
import { Admin } from "./admin";
import { emailReturnUrl } from "./domain";
const navigation = [
  ["Arena", "/play"],
  ["Play", "/play/quiz"],
  ["Predict", "/play/predict"],
  ["Rankings", "/play/standings"],
  ["Profile", "/play/profile"],
];
const countries = [
  ["MY", "Malaysia"],
  ["ID", "Indonesia"],
  ["IN", "India"],
  ["CN", "China"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["TH", "Thailand"],
  ["SG", "Singapore"],
  ["TW", "Taiwan"],
  ["HK", "Hong Kong"],
  ["PH", "Philippines"],
  ["VN", "Vietnam"],
  ["DK", "Denmark"],
  ["GB", "United Kingdom"],
  ["MT", "Malta"],
  ["US", "United States"],
];
export function V1App({ screen }: { screen: Screen }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [tick, setTick] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [pick, setPick] = useState<{ match: Match; athlete: string } | null>(
    null,
  );
  const [scope, setScope] = useState("event");
  const [league, setLeague] = useState("players");
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">(
    "login",
  );
  const refresh = useCallback(async (c: SupabaseClient) => {
    const { data, error } = await c.rpc("v1_home");
    if (error) throw error;
    setHome(data as Home);
    setServerOffset(new Date(data.server_now).getTime() - Date.now());
  }, []);
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const c = await v1Client();
        if (disposed) return;
        setClient(c);
        if (c) {
          const { data, error } = await c.auth.getSession();
          if (error) throw error;
          if (disposed) return;
          setSession(data.session);
          const listener = c.auth.onAuthStateChange((_event, next) => {
            if (!disposed) {
              setSession(next);
              setAttempt(null);
              setHome(null);
            }
          });
          unsubscribe = () => listener.data.subscription.unsubscribe();
        }
      } catch (e) {
        if (!disposed) setError(friendlyError(e));
      } finally {
        if (!disposed) setReady(true);
      }
    })();
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (!client) return;
    let active = true;
    const load = () =>
      void refresh(client).catch((e) => {
        if (active) setError(friendlyError(e));
      });
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [client, session, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const perform = useCallback(async (task: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, []);
  const quizAction = useCallback(
    async (id: string, action: string, position?: number, option?: number) => {
      if (!client) return;
      const { data, error } = await client.rpc("v1_quiz", {
        p_quiz_id: id,
        p_action: action,
        p_position: position ?? null,
        p_option: option ?? null,
      });
      if (error) throw error;
      setAttempt(data as Attempt | null);
      if (data)
        setServerOffset(new Date(data.server_now).getTime() - Date.now());
      await refresh(client);
    },
    [client, refresh],
  );
  const quizId = selectedQuiz || home?.quizzes[0]?.id || "";
  useEffect(() => {
    if (screen !== "quiz" || !session || !quizId) return;
    void perform(() => quizAction(quizId, "resume"));
  }, [screen, session?.user.id, quizId, quizAction, perform, session]);
  const remaining = attempt
    ? Math.min(
        15,
        Math.max(
          0,
          Math.ceil(
            (new Date(attempt.deadline).getTime() - (tick + serverOffset)) /
              1000,
          ),
        ),
      )
    : 15;
  useEffect(() => {
    if (
      screen !== "quiz" ||
      !attempt ||
      attempt.complete ||
      attempt.awaiting_next ||
      remaining > 0
    )
      return;
    void perform(() => quizAction(attempt.quiz_id, "resume"));
  }, [screen, attempt, remaining, quizAction, perform]);
  useEffect(() => {
    if (!client || !home?.tournament || screen !== "standings") return;
    let active = true;
    const load = async () => {
      const { data, error } = await client.rpc("v1_leaderboard", {
        p_tournament_id: home.tournament!.id,
        p_scope: scope,
        p_league: league,
      });
      if (active) {
        if (error) setError(friendlyError(error));
        else setRanks(data as Rank[]);
      }
    };
    setRanks([]);
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client, home?.tournament, screen, scope, league]);
  const onAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void perform(async () => {
      if (!client) return;
      const email = String(data.get("email") || ""),
        password = String(data.get("password") || "");
      if (authMode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: emailReturnUrl(location.origin, "reset"),
        });
        if (error) throw error;
        setMessage(
          "If that address has an account, a password reset link is on its way.",
        );
      } else if (authMode === "signup") {
        const { data: result, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: emailReturnUrl(location.origin, "account"),
          },
        });
        if (error) throw error;
        setMessage(
          result.session
            ? "You’re in. Set up your player profile to get started."
            : "Check your inbox to confirm your email, then sign in.",
        );
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Welcome back. Your arena is ready.");
      }
    });
  };
  const tournament = home?.tournament;
  const signedIn = !!session && !!home?.profile;
  const needsLogin =
    ["quiz", "predict", "profile", "admin"].includes(screen) && !signedIn;
  return (
    <div className="demo v1">
      <a className="skip" href="#v1-content">
        Skip to content
      </a>
      <header className="demo-header">
        <Link href="/play" className="brand" aria-label="BadmintonXP arena">
          <Image
            unoptimized
            width={720}
            height={1280}
            src="/demo/badmintonxp-crest-orange-transparent.png"
            alt=""
          />
          <span>
            BADMINTON<span>XP</span>
            <small className="demo-badge">Fan arena</small>
          </span>
        </Link>
        {signedIn ? (
          <Link className="xp-chip" href="/play/profile">
            <strong data-testid="v1-lifetime-xp">
              {home?.lifetime_xp || 0} XP
            </strong>
            <small>Lifetime XP</small>
          </Link>
        ) : (
          <Link className="button" href="/play/account">
            Sign in
          </Link>
        )}
      </header>
      <nav className="demo-nav" aria-label="Fan arena">
        {navigation.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              href === (screen === "arena" ? "/play" : `/play/${screen}`)
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <main id="v1-content" tabIndex={-1}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="v1-notice" role="status">
            {message}
          </p>
        )}
        {!ready ? (
          <p role="status">Opening your arena…</p>
        ) : !client ? (
          <section className="panel">
            <h1>Your next rally is coming.</h1>
            <p>
              The account arena hasn’t been connected to its new Supabase
              project yet.
            </p>
            <Link className="button primary" href="/demo">
              Play the guest demo →
            </Link>
          </section>
        ) : !home ? (
          <p role="status">Loading the arena…</p>
        ) : (
          <>
            {screen === "arena" && (
              <>
                <section className="hero" aria-labelledby="v1-event-title">
                  <Image
                    unoptimized
                    priority
                    width={720}
                    height={1280}
                    className="hero-art"
                    src="/demo/badmintonxp-arena-unbranded.jpg"
                    alt="Illustrated badminton athletes in a floodlit arena"
                  />
                  <div className="hero-top">
                    <span className="eyebrow">YOUR FAN ARENA</span>
                    <h1 id="v1-event-title">
                      {tournament?.name || "THE NEXT RALLY"}
                    </h1>
                    <p>
                      Your knowledge.
                      <br />
                      Your people.
                    </p>
                  </div>
                  <div className="hero-bottom">
                    <span className="live-label">EVERY RALLY COUNTS</span>
                    <h2>Play. Predict. Rise.</h2>
                    <p>
                      {tournament
                        ? "Free match calls. Quiz points. Shared pride."
                        : "The first tournament will appear here when it’s ready."}
                    </p>
                  </div>
                </section>
                {signedIn && (
                  <section className="level-card">
                    <div>
                      <span>
                        LEVEL {Math.floor(home.lifetime_xp / 250) + 1}
                      </span>
                      <strong>
                        {home.event_xp} XP <small>this event</small>
                      </strong>
                    </div>
                    <div
                      className="level-track"
                      role="progressbar"
                      aria-label="Level progress"
                      aria-valuenow={home.lifetime_xp % 250}
                      aria-valuemin={0}
                      aria-valuemax={250}
                    >
                      <span
                        style={{
                          width: `${((home.lifetime_xp % 250) / 250) * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      {250 - (home.lifetime_xp % 250)} XP to the next level
                    </small>
                  </section>
                )}
                <div className="arena-grid">
                  <section className="play-cards">
                    <Link
                      className="action-card primary"
                      href={signedIn ? "/play/quiz" : "/play/account"}
                    >
                      <span>
                        <small>15 SECONDS. ONE SHOT.</small>
                        <strong>PLAY QUIZ</strong>
                        <span>
                          {home.quizzes[0]?.attempt?.complete
                            ? `Scored ${home.quizzes[0].attempt.score} XP`
                            : "Earn 10 XP for every correct answer"}
                        </span>
                      </span>
                      <b aria-hidden="true">↗</b>
                    </Link>
                    <Link
                      className="action-card"
                      href={signedIn ? "/play/predict" : "/play/account"}
                    >
                      <span>
                        <small>BACK YOUR INSTINCT</small>
                        <strong>MAKE YOUR CALL</strong>
                        <span>Free predictions · 20 XP for a correct call</span>
                      </span>
                      <b aria-hidden="true">↗</b>
                    </Link>
                  </section>
                  <section className="panel">
                    <span className="eyebrow">YOUR PEOPLE</span>
                    <h2>
                      {home.teams.find((t) => t.id === home.profile?.team_id)
                        ?.name || "Find your team"}
                    </h2>
                    <p>Every point lifts your team and country too.</p>
                    <Link className="button" href="/play/standings">
                      See the rankings →
                    </Link>
                  </section>
                </div>
              </>
            )}
            {needsLogin ? (
              <section className="panel">
                <h1>Join the rally.</h1>
                <p>Sign in to save your scores and compete with your people.</p>
                <Link className="button primary" href="/play/account">
                  Sign in or create an account →
                </Link>
              </section>
            ) : (
              <>
                {screen === "account" &&
                  (signedIn ? (
                    <section className="panel">
                      <h1>You’re in.</h1>
                      <p>Welcome, {home.profile?.username}.</p>
                      <Link className="button primary" href="/play/profile">
                        Set up your profile →
                      </Link>
                      <Link className="button" href="/play">
                        Enter the arena →
                      </Link>
                    </section>
                  ) : (
                    <section className="panel v1-form-panel">
                      <span className="eyebrow">YOUR NEXT RALLY</span>
                      <h1>
                        {authMode === "signup"
                          ? "Join your people."
                          : authMode === "forgot"
                            ? "Back in the game."
                            : "Welcome back."}
                      </h1>
                      <form onSubmit={onAuth}>
                        <label>
                          Email
                          <input
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={254}
                          />
                        </label>
                        {authMode !== "forgot" && (
                          <label>
                            Password
                            <input
                              name="password"
                              type="password"
                              autoComplete={
                                authMode === "signup"
                                  ? "new-password"
                                  : "current-password"
                              }
                              minLength={12}
                              maxLength={128}
                              required
                            />
                          </label>
                        )}
                        <button className="primary wide" disabled={busy}>
                          {authMode === "signup"
                            ? "Create account"
                            : authMode === "forgot"
                              ? "Send reset link"
                              : "Sign in"}
                        </button>
                      </form>
                      <div className="button-row">
                        <button
                          onClick={() => {
                            setAuthMode(
                              authMode === "signup" ? "login" : "signup",
                            );
                            setMessage("");
                          }}
                        >
                          {authMode === "signup"
                            ? "I have an account"
                            : "Create an account"}
                        </button>
                        <button
                          onClick={() => {
                            setAuthMode("forgot");
                            setMessage("");
                          }}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <p className="muted">
                        Your username, country, team and leaderboard totals are
                        visible to other fans. Your email and individual answers
                        stay private.
                      </p>
                    </section>
                  ))}
                {screen === "reset" && (
                  <section className="panel v1-form-panel">
                    <h1>A fresh start.</h1>
                    {session ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          void perform(async () => {
                            const password = String(data.get("password"));
                            if (password !== data.get("confirmation")) {
                              setError("Passwords don’t match.");
                              return;
                            }
                            const { error } = await client.auth.updateUser({
                              password,
                            });
                            if (error) throw error;
                            await client.auth.signOut({ scope: "global" });
                            setMessage(
                              "Password updated. Sign in with your new password.",
                            );
                          });
                        }}
                      >
                        <label>
                          New password
                          <input
                            type="password"
                            name="password"
                            minLength={12}
                            maxLength={128}
                            autoComplete="new-password"
                            required
                          />
                        </label>
                        <label>
                          Confirm password
                          <input
                            type="password"
                            name="confirmation"
                            minLength={12}
                            maxLength={128}
                            autoComplete="new-password"
                            required
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          Save new password
                        </button>
                      </form>
                    ) : (
                      <p>
                        Open the password reset link from your email on the same
                        browser where you requested it, or{" "}
                        <Link href="/play/account">request a new link</Link>.
                      </p>
                    )}
                  </section>
                )}
                {screen === "profile" && signedIn && (
                  <section className="panel v1-form-panel">
                    <span className="eyebrow">YOUR PLAYER CARD</span>
                    <h1>Find your people.</h1>
                    <form
                      key={home.profile?.id}
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void perform(async () => {
                          const { error } = await client.rpc("v1_profile", {
                            p_username: data.get("username"),
                            p_country: data.get("country"),
                            p_team_id: data.get("team") || null,
                          });
                          if (error) throw error;
                          await refresh(client);
                          setMessage("Player profile saved.");
                        });
                      }}
                    >
                      <label>
                        Username
                        <input
                          name="username"
                          defaultValue={home.profile?.username}
                          minLength={3}
                          maxLength={24}
                          pattern="[A-Za-z0-9_]{3,24}"
                          required
                          autoComplete="nickname"
                        />
                      </label>
                      <label>
                        Country
                        <select
                          name="country"
                          defaultValue={home.profile?.country}
                        >
                          {countries.map(([code, name]) => (
                            <option value={code} key={code}>
                              {name}
                            </option>
                          ))}
                          {home.profile &&
                            !countries.some(
                              ([code]) => code === home.profile?.country,
                            ) && <option>{home.profile.country}</option>}
                        </select>
                      </label>
                      <label>
                        Team
                        <select
                          name="team"
                          defaultValue={home.profile?.team_id || ""}
                        >
                          <option value="">Independent fan</option>
                          {home.teams.map((t) => (
                            <option value={t.id} key={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="muted">
                        Choose your team and country before playing. They lock
                        with your first quiz or prediction.
                      </p>
                      <button className="primary" disabled={busy}>
                        Save profile
                      </button>
                    </form>
                    <p>
                      Lifetime XP: <strong>{home.lifetime_xp}</strong> · This
                      event: <strong>{home.event_xp}</strong>
                    </p>
                    {home.admin && (
                      <Link className="button" href="/play/admin">
                        Tournament admin →
                      </Link>
                    )}
                    <button
                      onClick={() =>
                        void perform(async () => {
                          const { error } = await client.auth.signOut({
                            scope: "global",
                          });
                          if (error) throw error;
                          setHome(null);
                          setAttempt(null);
                          setSession(null);
                          await refresh(client);
                        })
                      }
                      disabled={busy}
                    >
                      Sign out all sessions
                    </button>
                  </section>
                )}
                {screen === "quiz" && signedIn && (
                  <section className="challenge-section">
                    <span className="eyebrow">SHUTTLE IQ</span>
                    <h1>
                      Know the game.
                      <br />
                      <span>Own the rally.</span>
                    </h1>
                    {home.quizzes.length === 0 ? (
                      <div className="panel">
                        <p>
                          No quiz is open yet. Come back when the tournament
                          begins.
                        </p>
                      </div>
                    ) : (
                      <>
                        <label className="v1-select">
                          Quiz
                          <select
                            value={quizId}
                            onChange={(e) => {
                              setSelectedQuiz(e.target.value);
                              setAttempt(null);
                            }}
                          >
                            {home.quizzes.map((q) => (
                              <option value={q.id} key={q.id}>
                                {q.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="panel quiz-panel">
                          {!attempt ? (
                            <>
                              <h2>
                                {
                                  home.quizzes.find((q) => q.id === quizId)
                                    ?.title
                                }
                              </h2>
                              <p>
                                15 seconds per question. Your first answer is
                                final. Earn 10 XP for each correct answer.
                              </p>
                              <p className="muted">
                                The clock keeps running if you leave. You can
                                play each quiz once.
                              </p>
                              <button
                                className="primary wide"
                                disabled={busy}
                                onClick={() =>
                                  void perform(() =>
                                    quizAction(quizId, "start"),
                                  )
                                }
                              >
                                Start quiz →
                              </button>
                            </>
                          ) : attempt.complete ? (
                            <div role="status">
                              <span className="eyebrow">RALLY COMPLETE</span>
                              <h2>That’s your rally.</h2>
                              <strong
                                className="big-xp"
                                data-testid="v1-quiz-score"
                              >
                                +{attempt.score} XP
                              </strong>
                              <ol className="answer-review">
                                {attempt.answers.map((a) => (
                                  <li key={a.position}>
                                    <strong>
                                      Q{a.position + 1} ·{" "}
                                      {a.option === null
                                        ? "Timed out"
                                        : a.xp
                                          ? "Correct"
                                          : "Incorrect"}{" "}
                                      · {a.xp} XP
                                    </strong>
                                    <span>{a.explanation}</span>
                                  </li>
                                ))}
                              </ol>
                              <Link
                                className="button primary"
                                href="/play/predict"
                              >
                                Make your match call →
                              </Link>
                            </div>
                          ) : attempt.awaiting_next ? (
                            <div
                              className={`answer-reveal ${attempt.answers.at(-1)?.xp ? "is-correct" : "is-wrong"}`}
                              role="status"
                            >
                              <h2>
                                {attempt.answers.at(-1)?.xp
                                  ? "Clean winner."
                                  : "Keep your head in the game."}
                              </h2>
                              <strong className="big-xp xp-pop">
                                +{attempt.answers.at(-1)?.xp} XP
                              </strong>
                              <p>{attempt.answers.at(-1)?.explanation}</p>
                              <button
                                className="primary wide"
                                disabled={busy}
                                onClick={() =>
                                  void perform(() => quizAction(quizId, "next"))
                                }
                              >
                                Next question →
                              </button>
                            </div>
                          ) : (
                            attempt.question && (
                              <>
                                <div className="section-head">
                                  <span className="eyebrow">
                                    QUESTION {attempt.question.position + 1} /{" "}
                                    {
                                      home.quizzes.find((q) => q.id === quizId)
                                        ?.question_count
                                    }
                                  </span>
                                  <strong
                                    className={`timer ${remaining <= 5 ? "urgent" : ""}`}
                                    role="timer"
                                    aria-label={`${remaining} seconds remaining`}
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
                                        strokeDashoffset={
                                          100 - (remaining / 15) * 100
                                        }
                                      />
                                    </svg>
                                    <span>{remaining}s</span>
                                  </strong>
                                </div>
                                <h2 data-testid="v1-question">
                                  {attempt.question.prompt}
                                </h2>
                                <div className="answer-grid">
                                  {attempt.question.options.map((o, i) => (
                                    <button
                                      key={i}
                                      disabled={busy || remaining === 0}
                                      onClick={() =>
                                        void perform(() =>
                                          quizAction(
                                            quizId,
                                            "answer",
                                            attempt.question!.position,
                                            i,
                                          ),
                                        )
                                      }
                                    >
                                      <span>{String.fromCharCode(65 + i)}</span>
                                      {o}
                                    </button>
                                  ))}
                                </div>
                                <p className="muted">
                                  First tap. Final answer.
                                </p>
                              </>
                            )
                          )}
                        </div>
                      </>
                    )}
                  </section>
                )}
                {screen === "predict" && signedIn && (
                  <section className="challenge-section">
                    <span className="eyebrow">THE MATCH CALL</span>
                    <h1>Back your instinct.</h1>
                    {home.matches.length === 0 && (
                      <p className="panel">No matches announced yet.</p>
                    )}
                    {home.matches.map((m) => {
                      const seconds = Math.max(
                        0,
                        Math.ceil(
                          (new Date(m.closes_at).getTime() -
                            (tick + serverOffset)) /
                            1000,
                        ),
                      );
                      return (
                        <section className="panel v1-match" key={m.id}>
                          <span className="pill">
                            {m.winner
                              ? "MATCH FINISHED"
                              : m.entry
                                ? "PICK LOCKED"
                                : seconds === 0
                                  ? "ENTRIES CLOSED"
                                  : "ENTRIES OPEN"}
                          </span>
                          <h2>
                            {m.athlete_a} vs {m.athlete_b}
                          </h2>
                          <p>
                            {seconds
                              ? `Closes in ${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`
                              : "Entries closed"}
                          </p>
                          <div className="answer-grid prediction-grid">
                            {[m.athlete_a, m.athlete_b].map((athlete, i) => (
                              <button
                                key={athlete}
                                disabled={
                                  busy ||
                                  !!m.entry ||
                                  !!m.winner ||
                                  seconds === 0
                                }
                                aria-pressed={m.entry?.pick === athlete}
                                onClick={() => setPick({ match: m, athlete })}
                              >
                                <span className="athlete-number">0{i + 1}</span>
                                <strong>{athlete}</strong>
                                <small>
                                  {m.entry?.pick === athlete
                                    ? "YOUR LOCKED PICK ✓"
                                    : m.entry
                                      ? "Not picked"
                                      : "MAKE YOUR CALL"}
                                </small>
                              </button>
                            ))}
                          </div>
                          {pick?.match.id === m.id &&
                            !m.entry &&
                            !m.winner &&
                            seconds > 0 && (
                              <div
                                className="reset-confirm"
                                role="group"
                                aria-label="Confirm prediction"
                              >
                                <p>
                                  Lock {pick.athlete}? You can’t change your
                                  pick.
                                </p>
                                <div className="button-row">
                                  <button
                                    className="primary"
                                    disabled={busy}
                                    onClick={() =>
                                      void perform(async () => {
                                        const { error } = await client.rpc(
                                          "v1_predict",
                                          {
                                            p_match_id: m.id,
                                            p_pick: pick.athlete,
                                          },
                                        );
                                        if (error) throw error;
                                        setPick(null);
                                        await refresh(client);
                                      })
                                    }
                                  >
                                    Lock {pick.athlete}
                                  </button>
                                  <button
                                    autoFocus
                                    onClick={() => setPick(null)}
                                  >
                                    Keep choosing
                                  </button>
                                </div>
                              </div>
                            )}
                          <p role="status" data-testid="v1-prediction-status">
                            {m.winner
                              ? m.entry?.pick === m.winner
                                ? `${m.winner} wins! You called it. +20 XP`
                                : m.entry
                                  ? `${m.winner} wins. Better luck next time.`
                                  : `${m.winner} wins. No entry this time.`
                              : m.entry
                                ? `Your ${m.entry.pick} pick is locked. Waiting for the result.`
                                : "A correct call earns 20 XP."}
                          </p>
                        </section>
                      );
                    })}
                  </section>
                )}
                {screen === "standings" && (
                  <section className="standings-section">
                    <span className="eyebrow">FRIENDLY RIVALRY</span>
                    <h1>Never rise alone.</h1>
                    <p>
                      {tournament?.name || "The first event is on its way."}
                    </p>
                    <div className="filter-row" aria-label="Standings period">
                      {["event", "season"].map((s) => (
                        <button
                          key={s}
                          aria-pressed={scope === s}
                          onClick={() => setScope(s)}
                        >
                          {s === "event" ? "Current event" : "Season"}
                        </button>
                      ))}
                    </div>
                    <div className="filter-row" aria-label="Standings group">
                      {["players", "teams", "countries"].map((l) => (
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
                    <div className="table-wrap">
                      <table data-testid="v1-standings">
                        <caption>
                          {scope === "event" ? tournament?.name : "Season"} ·{" "}
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
                          {ranks.map((r) => (
                            <tr
                              key={r.id}
                              className={r.id === session?.user.id ? "you" : ""}
                            >
                              <td>#{r.rank}</td>
                              <th scope="row">{r.name}</th>
                              <td>{r.xp}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ranks.length === 0 && (
                        <p>No scores yet. Be the first to rally.</p>
                      )}
                    </div>
                  </section>
                )}
                {screen === "admin" &&
                  signedIn &&
                  (home.admin ? (
                    <Admin
                      client={client}
                      busy={busy}
                      perform={perform}
                      onSaved={() => refresh(client)}
                    />
                  ) : (
                    <section className="panel">
                      <h1>Players’ side.</h1>
                      <p>This area is reserved for tournament admins.</p>
                      <Link href="/play">Back to the arena →</Link>
                    </section>
                  ))}
              </>
            )}
          </>
        )}
      </main>
      <footer>
        <p>Independent fan game. No prizes or payments.</p>
        <Link href="/demo">Try the fictional guest demo</Link>
      </footer>
    </div>
  );
}
