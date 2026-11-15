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
import {
  AlarmClock,
  CircleUserRound,
  House,
  Play,
  Target,
  Trophy,
} from "lucide-react";
import {
  ArenaSkeleton,
  deadlineLabel,
  levelFor,
  LevelCelebration,
  QuizFeedback,
  XPProgress,
  SoundToggle,
  Streak,
  useGameFeedback,
  XPMeter,
} from "./game-ui";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { friendlyError, v1Client } from "./client";
import type { Attempt, Home, Match, Screen } from "./types";
import { Admin } from "./admin";
import { emailReturnUrl } from "./domain";
import { ArenaChallenges } from "./arena-challenges";
import { QuizAnswers, QuizTimer } from "./quiz-ui";
import {
  ArenaRankings,
  tournamentStatus,
  TournamentStandings,
  type TournamentRankings,
} from "./tournament-rankings";
const eventDates = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const navigation = [
  ["Arena", "/play", House],
  ["Quiz", "/play/quiz", Play],
  ["Predict", "/play/predict", Target],
  ["Rankings", "/play/standings", Trophy],
  ["Profile", "/play/profile", CircleUserRound],
] as const;
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
  const { sound, toggleSound, feedback, activateAudio } = useGameFeedback();
  const [celebration, setCelebration] = useState<number | null>(null);
  const previousLevel = useRef<{ player: string; level: number } | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const previousAttempt = useRef<Attempt | null>(null);
  const [freshAnswer, setFreshAnswer] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [challengeLink, setChallengeLink] = useState<{
    quiz: string | null;
    match: string | null;
  } | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setChallengeLink({ quiz: query.get("quiz"), match: query.get("match") });
  }, [screen]);
  const [pick, setPick] = useState<{ match: Match; athlete: string } | null>(
    null,
  );
  const [rankings, setRankings] = useState<TournamentRankings | null>(null);
  const [rankingsFailed, setRankingsFailed] = useState(false);
  const tournamentId = home?.tournament?.id ?? null;
  const currentRankings =
    rankings?.tournament_id === tournamentId ? rankings : null;
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
        if (c) {
          const { data, error } = await c.auth.getSession();
          if (error) throw error;
          if (disposed) return;
          setSession(data.session);
          const listener = c.auth.onAuthStateChange((event, next) => {
            if (!disposed && event !== "INITIAL_SESSION") {
              setSession(next);
              setAttempt(null);
              setHome(null);
            }
          });
          unsubscribe = () => listener.data.subscription.unsubscribe();
        }
        setClient(c);
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
    if (!client || !ready) return;
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
  }, [client, ready, session, refresh]);
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
  const gameNow = tick + serverOffset;
  const secondsUntil = (deadline: string) =>
    Math.max(0, Math.ceil((new Date(deadline).getTime() - gameNow) / 1000));
  const playableQuizzes =
    home?.quizzes.filter(
      (item) =>
        !secondsUntil(item.opens_at) &&
        secondsUntil(item.closes_at) &&
        !item.attempt?.complete,
    ) ?? [];
  const quiz =
    home?.quizzes.find(
      (item) =>
        item.id === (selectedQuiz || challengeLink?.quiz || attempt?.quiz_id),
    ) ??
    playableQuizzes[0] ??
    home?.quizzes[0];
  const quizId = quiz?.id ?? "";
  const solePlayableSelected =
    playableQuizzes.length === 1 && playableQuizzes[0].id === quizId;
  const quizOpensIn = quiz ? secondsUntil(quiz.opens_at) : 0;
  const quizClosesIn = quiz ? secondsUntil(quiz.closes_at) : 0;
  const quizStatus =
    attempt?.complete || quiz?.attempt?.complete
      ? "SETTLED"
      : attempt?.question || attempt?.awaiting_next
        ? "LIVE"
        : quizOpensIn || !quizClosesIn
          ? "LOCKED"
          : "OPEN";
  const lastAnswer = attempt?.answers.at(-1);
  const answerKey = lastAnswer ? `${attempt?.id}:${lastAnswer.position}` : "";
  let streak = 0;
  for (const answer of [...(attempt?.answers ?? [])].reverse()) {
    if (!answer.xp) break;
    streak++;
  }
  useEffect(() => {
    const previous = previousAttempt.current;
    previousAttempt.current = attempt;
    if (
      !attempt ||
      !lastAnswer ||
      previous?.id !== attempt.id ||
      previous.answers.length >= attempt.answers.length
    )
      return;
    setFreshAnswer(answerKey);
    feedback(
      lastAnswer.option === null
        ? "timeout"
        : lastAnswer.xp
          ? "correct"
          : "wrong",
    );
  }, [attempt, lastAnswer, answerKey, feedback]);
  useEffect(() => {
    if (!session || !home?.profile || home.profile.id !== session.user.id) {
      if (!session && previousLevel.current) {
        previousLevel.current = null;
        setCelebration(null);
      }
      return;
    }
    const player = session.user.id;
    const { level } = levelFor(home.lifetime_xp);
    const prior = previousLevel.current;
    previousLevel.current = { player, level };
    if (prior && prior.player !== player) setCelebration(null);
    if (prior?.player === player && level > prior.level) {
      setCelebration(level);
      feedback("level");
    }
  }, [session, home, feedback]);
  useEffect(() => {
    if (screen !== "quiz" || !session || !quizId || !challengeLink) return;
    void perform(() => quizAction(quizId, "resume"));
  }, [
    screen,
    session?.user.id,
    quizId,
    quizAction,
    perform,
    session,
    challengeLink,
  ]);
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
    if (!client || (screen !== "standings" && screen !== "arena")) return;
    let active = true;
    const load = async () => {
      const { data, error } = await client.rpc("v1_tournament_rankings");
      if (!active) return;
      setRankingsFailed(Boolean(error));
      if (!error) setRankings(data as TournamentRankings);
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client, screen, session, tournamentId]);
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
  const linkedMatch = challengeLink?.match;
  const linkedMatchAvailable = Boolean(
    home?.matches.some((match) => match.id === linkedMatch),
  );
  useEffect(() => {
    if (screen === "predict" && linkedMatch && linkedMatchAvailable) {
      document
        .getElementById(`match-${linkedMatch}`)
        ?.scrollIntoView({ block: "start" });
    }
  }, [screen, linkedMatch, linkedMatchAvailable]);
  const tournament = home?.tournament;
  const signedIn = Boolean(session && home?.profile?.id === session.user.id);
  const waitingForAccount =
    !ready || Boolean(client && (!home || (session && !signedIn)));
  const needsLogin =
    ["quiz", "predict", "profile", "admin"].includes(screen) && !signedIn;
  return (
    <div
      className="demo v1"
      data-screen={screen}
      onClickCapture={activateAudio}
    >
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
        <div className="game-header-controls">
          {waitingForAccount ? (
            !error && <ArenaSkeleton compact />
          ) : signedIn && home ? (
            <Link className="game-player" href="/play/profile">
              <XPMeter xp={home.lifetime_xp} />
            </Link>
          ) : client ? (
            <Link className="button" href="/play/account">
              Sign in
            </Link>
          ) : null}
          <SoundToggle sound={sound} onToggle={toggleSound} />
        </div>
      </header>
      <nav className="demo-nav" aria-label="Fan arena">
        {navigation.map(([label, href, Icon]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              href ===
              (screen === "arena"
                ? "/play"
                : screen === "account" ||
                    screen === "reset" ||
                    screen === "admin"
                  ? "/play/profile"
                  : `/play/${screen}`)
                ? "page"
                : undefined
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="arena-scroll">
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
            <ArenaSkeleton />
          ) : !client ? (
            <section className="panel">
              <h1>We’ll be back shortly.</h1>
              <p>The arena is taking a break. Please try again soon.</p>
              <Link className="button primary" href="/demo">
                Play the guest demo →
              </Link>
            </section>
          ) : !home || waitingForAccount ? (
            !error && <ArenaSkeleton />
          ) : (
            <>
              {screen === "arena" && (
                <>
                  <section
                    className="arena-event-hero"
                    aria-labelledby="v1-event-title"
                  >
                    {tournament?.hero_image_url && (
                      <Image
                        src={tournament.hero_image_url}
                        alt={tournament.hero_image_alt ?? ""}
                        fill
                        unoptimized
                        priority
                        sizes="(max-width: 760px) 100vw, 1180px"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    )}
                    <div>
                      <h1 id="v1-event-title">
                        {tournament?.name || "The next rally"}
                      </h1>
                      {tournament ? (
                        <p>
                          {[
                            tournament.city,
                            eventDates.formatRange(
                              new Date(tournament.starts_at),
                              new Date(tournament.ends_at),
                            ),
                            tournamentStatus(
                              tournament,
                              gameNow,
                              currentRankings?.final ?? false,
                            ),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : (
                        <p>
                          The first tournament will appear here when it’s ready.
                        </p>
                      )}
                    </div>
                  </section>
                  <ArenaRankings
                    data={currentRankings}
                    profile={signedIn ? home.profile : null}
                    failed={rankingsFailed}
                  />
                  <ArenaChallenges
                    home={home}
                    now={gameNow}
                    signedIn={signedIn}
                  />
                  {signedIn && (
                    <section
                      className="level-card game-home-scores"
                      aria-label="Player progress"
                    >
                      <div className="game-home-level">
                        <strong>Level progress</strong>
                        <XPProgress
                          xp={home.lifetime_xp}
                          label="Lifetime XP toward next level"
                        />
                        <small>
                          {home.lifetime_xp} lifetime XP ·{" "}
                          {250 - (home.lifetime_xp % 250)} XP to next level
                        </small>
                      </div>
                      <div className="game-event-score">
                        <span>Event score</span>
                        <strong>{home.event_xp} XP</strong>
                      </div>
                    </section>
                  )}
                </>
              )}
              {needsLogin ? (
                <section className="panel">
                  <h1>Join the rally.</h1>
                  <p>
                    Sign in to save your scores and compete with your people.
                  </p>
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
                                minLength={6}
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
                          Your username, country, team and leaderboard totals
                          are visible to other fans. Your email and individual
                          answers stay private.
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
                              minLength={6}
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
                              minLength={6}
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
                          Open the password reset link from your email on the
                          same browser where you requested it.
                          <br />
                          <Link className="button" href="/play/account">
                            Request a new link
                          </Link>
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
                      {(home.admin || home.content_editor) && (
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
                          {home.quizzes.length > 1 && (
                            <details
                              className="game-quiz-choices"
                              key={String(solePlayableSelected)}
                              open={!solePlayableSelected}
                            >
                              <summary>
                                {solePlayableSelected
                                  ? "Other quizzes"
                                  : "Choose a quiz"}
                              </summary>
                              <div
                                className="game-quiz-picker"
                                role="group"
                                aria-label="Choose a quiz"
                              >
                                {home.quizzes.map((item) => {
                                  const opensIn = secondsUntil(item.opens_at);
                                  const closesIn = secondsUntil(item.closes_at);
                                  const status =
                                    item.id === quizId
                                      ? quizStatus
                                      : item.attempt?.complete
                                        ? "SETTLED"
                                        : opensIn || !closesIn
                                          ? "LOCKED"
                                          : "OPEN";
                                  if (
                                    solePlayableSelected &&
                                    item.id === quizId
                                  )
                                    return null;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      aria-pressed={item.id === quizId}
                                      disabled={busy}
                                      onClick={() => {
                                        if (item.id === quizId) return;
                                        setSelectedQuiz(item.id);
                                        setAttempt(null);
                                      }}
                                    >
                                      <strong>{item.title}</strong>
                                      <span className="game-card-meta">
                                        <span
                                          className="game-status"
                                          data-state={status}
                                        >
                                          {status}
                                        </span>
                                        {status !== "SETTLED" && (
                                          <span>
                                            {opensIn
                                              ? deadlineLabel(opensIn, "Opens")
                                              : closesIn
                                                ? deadlineLabel(closesIn)
                                                : "Entries closed"}
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </details>
                          )}
                          <div
                            className="panel quiz-panel"
                            data-live={quizStatus === "LIVE"}
                          >
                            <div className="game-card-art game-quiz-art">
                              <div className="game-card-meta">
                                <span
                                  className="game-status"
                                  data-state={quizStatus}
                                >
                                  {quizStatus}
                                </span>
                                {!attempt?.complete &&
                                  !quiz?.attempt?.complete && (
                                    <span>
                                      {quizOpensIn
                                        ? deadlineLabel(quizOpensIn, "Opens")
                                        : quizClosesIn
                                          ? deadlineLabel(quizClosesIn)
                                          : "Entries closed"}
                                    </span>
                                  )}
                              </div>
                              <h2>{quiz?.title}</h2>
                            </div>
                            {busy && !attempt ? (
                              <ArenaSkeleton />
                            ) : !attempt ? (
                              <>
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
                                  <Play
                                    size={18}
                                    fill="currentColor"
                                    aria-hidden="true"
                                  />{" "}
                                  Start quiz
                                </button>
                              </>
                            ) : attempt.complete ? (
                              <div role="status">
                                {lastAnswer && answerKey === freshAnswer && (
                                  <QuizFeedback
                                    key={answerKey}
                                    answer={lastAnswer}
                                    animate
                                  />
                                )}
                                <Streak count={streak} />
                                <div className="eyebrow">RALLY COMPLETE</div>
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
                              <div role="status" className="game-reveal">
                                {lastAnswer && (
                                  <QuizFeedback
                                    key={answerKey}
                                    answer={lastAnswer}
                                    animate={answerKey === freshAnswer}
                                  />
                                )}
                                <Streak count={streak} />
                                <p>{lastAnswer?.explanation}</p>
                                <button
                                  className="primary wide"
                                  disabled={busy}
                                  onClick={() =>
                                    void perform(() =>
                                      quizAction(quizId, "next"),
                                    )
                                  }
                                >
                                  Next question →
                                </button>
                              </div>
                            ) : (
                              attempt.question && (
                                <>
                                  <div className="section-head">
                                    <div className="game-question-meta">
                                      <span className="eyebrow">
                                        QUESTION {attempt.question.position + 1}{" "}
                                        / {quiz?.question_count}
                                      </span>
                                      <div className="game-question-feedback">
                                        <Streak count={streak} />
                                        {lastAnswer?.option === null &&
                                          answerKey === freshAnswer && (
                                            <span
                                              key={answerKey}
                                              className="game-buzzer"
                                              role="status"
                                            >
                                              <AlarmClock
                                                size={15}
                                                aria-hidden="true"
                                              />{" "}
                                              Time’s up!
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                    <QuizTimer remaining={remaining} />
                                  </div>
                                  <h2 data-testid="v1-question">
                                    {attempt.question.prompt}
                                  </h2>
                                  <QuizAnswers
                                    options={attempt.question.options}
                                    disabled={busy || remaining === 0}
                                    onAnswer={(index) =>
                                      void perform(() =>
                                        quizAction(
                                          quizId,
                                          "answer",
                                          attempt.question!.position,
                                          index,
                                        ),
                                      )
                                    }
                                  />
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
                        const seconds = secondsUntil(m.closes_at);
                        const opens = m.opens_at ? secondsUntil(m.opens_at) : 0;
                        const matchStatus = m.winner
                          ? "SETTLED"
                          : m.entry || !seconds || opens
                            ? "LOCKED"
                            : "OPEN";
                        return (
                          <section
                            className="panel v1-match"
                            key={m.id}
                            id={`match-${m.id}`}
                          >
                            <div className="game-card-art game-match-art">
                              <div className="game-card-meta">
                                <span
                                  className="game-status"
                                  data-state={matchStatus}
                                >
                                  {matchStatus}
                                </span>
                                <span>
                                  {m.winner
                                    ? "Result confirmed"
                                    : seconds
                                      ? opens
                                        ? deadlineLabel(opens, "Opens")
                                        : deadlineLabel(seconds)
                                      : "Entries closed"}
                                </span>
                              </div>
                              <h2>
                                {m.athlete_a} <span>vs</span> {m.athlete_b}
                              </h2>
                            </div>
                            <div className="answer-grid prediction-grid">
                              {[m.athlete_a, m.athlete_b].map((athlete, i) => (
                                <button
                                  key={athlete}
                                  disabled={
                                    busy ||
                                    !!m.entry ||
                                    !!m.winner ||
                                    seconds === 0 ||
                                    opens > 0
                                  }
                                  aria-pressed={m.entry?.pick === athlete}
                                  onClick={() => setPick({ match: m, athlete })}
                                >
                                  <span className="athlete-number">
                                    0{i + 1}
                                  </span>
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
                              seconds > 0 &&
                              !opens && (
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
                                          feedback("locked");
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
                    <TournamentStandings
                      tournament={tournament ?? null}
                      now={gameNow}
                      data={currentRankings}
                      failed={rankingsFailed}
                      profile={signedIn ? home.profile : null}
                    />
                  )}
                  {screen === "admin" &&
                    signedIn &&
                    (home.admin || home.content_editor ? (
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
                        <Link className="button" href="/play">
                          Back to the arena →
                        </Link>
                      </section>
                    ))}
                </>
              )}
            </>
          )}
        </main>
        {celebration !== null &&
          signedIn &&
          !(
            screen === "quiz" &&
            attempt?.question &&
            !attempt.awaiting_next &&
            !attempt.complete
          ) && (
            <LevelCelebration
              level={celebration}
              onClose={() => setCelebration(null)}
            />
          )}
        <footer>
          <p>Independent fan game. No prizes or payments.</p>
          <Link className="button" href="/demo">
            Try the fictional guest demo
          </Link>
        </footer>
      </div>
    </div>
  );
}
