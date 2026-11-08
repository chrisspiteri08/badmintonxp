/** Provisional DEMO rules. No accounts, live results, prizes or competitive trust. */
export const RULES = Object.freeze({
  quizXP: 10,
  predictionXP: 20,
  questionMs: 15_000,
  predictionWindowMs: 300_000,
});
export const STORE_KEY = "badmintonxp:guest:v1";
export const SEASON = "demo-season";
export const EVENT = "birmingham-demo";
export const PAST_EVENT = "harbour-demo";
export const QUIZ = "shuttle-iq";
export const PREDICTION = "ember-kite";
export const GUEST = "guest";
export const PEOPLE = [
  {
    id: GUEST,
    name: "Rally Rookie",
    team: "Neon Shuttles",
    country: "Malaysia",
  },
  {
    id: "nomad",
    name: "Net Nomad",
    team: "Baseline Crew",
    country: "Indonesia",
  },
  { id: "fox", name: "Court Fox", team: "Sky Smashers", country: "Thailand" },
  {
    id: "scout",
    name: "Shuttle Scout",
    team: "Neon Shuttles",
    country: "Malaysia",
  },
  { id: "ace", name: "Orbit Ace", team: "Baseline Crew", country: "Indonesia" },
] as const;
export const QUESTIONS = [
  {
    text: "How many feathers does a standard feather shuttlecock have?",
    options: ["12", "14", "16", "18"],
    correct: 2,
    explanation: "A standard feather shuttle has 16 feathers.",
  },
  {
    text: "At 20–20, what lead normally wins a badminton game?",
    options: ["One point", "Two points", "Three points", "Four points"],
    correct: 1,
    explanation: "A two-point lead wins, until the 30-point cap.",
  },
  {
    text: "Which shot travels softly just over the net?",
    options: ["Smash", "Clear", "Net shot", "Drive"],
    correct: 2,
    explanation: "A net shot drops softly just over the net.",
  },
] as const;
export type Award = {
  id: string;
  user: string;
  challenge: string;
  event: string;
  season: string;
  team: string;
  country: string;
  xp: number;
};
export type Answer = { option: number | null; xp: number; at: number };
export type Attempt = {
  answers: Answer[];
  deadline: number;
  awaitingNext: boolean;
  complete: boolean;
};
export type DemoState = {
  version: 1;
  createdAt: number;
  lastNow: number;
  offset: number;
  predictionDeadline: number;
  entry: { option: "Ember" | "Kite"; at: number } | null;
  settled: boolean;
  attempt: Attempt | null;
  ledger: Award[];
};
export type Action =
  | { type: "tick" | "start" | "next" | "close" | "settle" }
  | { type: "answer"; index: number; option: number }
  | { type: "predict"; option: "Ember" | "Kite" };
export type Scope = "event" | "season";
export type League = "players" | "teams" | "countries";
export function addAward(state: DemoState, award: Award): DemoState {
  if (state.ledger.some((a) => a.id === award.id)) return state;
  return { ...state, ledger: [...state.ledger, award] };
}
function guestAward(challenge: string, xp: number): Award {
  return {
    id: `${GUEST}:${challenge}:${EVENT}`,
    user: GUEST,
    challenge,
    event: EVENT,
    season: SEASON,
    team: PEOPLE[0].team,
    country: PEOPLE[0].country,
    xp,
  };
}
export function freshState(now: number): DemoState {
  const ledger: Award[] = [];
  // Every baseline is an attributed award, never an extra total outside the ledger.
  PEOPLE.forEach((p, i) => {
    [EVENT, PAST_EVENT].forEach((event, j) =>
      ledger.push({
        id: `seed:${p.id}:${event}`,
        user: p.id,
        challenge: `fixture-${event}`,
        event,
        season: SEASON,
        team: p.team,
        country: p.country,
        xp: (j === 0 ? [40, 65, 55, 45, 20] : [100, 20, 90, 40, 80])[i],
      }),
    );
  });
  return {
    version: 1,
    createdAt: now,
    lastNow: now,
    offset: 0,
    predictionDeadline: now + RULES.predictionWindowMs,
    entry: null,
    settled: false,
    attempt: null,
    ledger,
  };
}
export function demoNow(state: DemoState, realNow: number): number {
  return Math.max(state.lastNow, realNow + state.offset);
}
function finish(state: DemoState): DemoState {
  if (!state.attempt?.complete) return state;
  return addAward(
    state,
    guestAward(
      QUIZ,
      state.attempt.answers.reduce((sum, a) => sum + a.xp, 0),
    ),
  );
}
export function reconcile(state: DemoState, realNow: number): DemoState {
  const now = demoNow(state, realNow);
  let next = state;
  // Unanswered questions keep consecutive absolute 15s windows while away.
  // A locked answer waits for Continue; the next question has not started yet.
  if (
    state.attempt &&
    !state.attempt.complete &&
    !state.attempt.awaitingNext &&
    now >= state.attempt.deadline
  ) {
    const attempt = { ...state.attempt, answers: [...state.attempt.answers] };
    while (!attempt.complete && now >= attempt.deadline) {
      attempt.answers.push({ option: null, xp: 0, at: attempt.deadline });
      attempt.complete = attempt.answers.length === QUESTIONS.length;
      if (!attempt.complete) attempt.deadline += RULES.questionMs;
    }
    next = finish({ ...state, attempt });
  }
  return now === next.lastNow ? next : { ...next, lastNow: now };
}
export function act(
  state: DemoState,
  action: Action,
  realNow: number,
): DemoState {
  let next = reconcile(state, realNow);
  const now = demoNow(next, realNow);
  const attempt = next.attempt;
  if (action.type === "start" && !attempt)
    next = {
      ...next,
      attempt: {
        answers: [],
        deadline: now + RULES.questionMs,
        awaitingNext: false,
        complete: false,
      },
    };
  if (
    action.type === "answer" &&
    attempt &&
    !attempt.complete &&
    !attempt.awaitingNext &&
    action.index === attempt.answers.length &&
    now < attempt.deadline &&
    Number.isInteger(action.option) &&
    action.option >= 0 &&
    action.option < 4
  ) {
    const answers = [
      ...attempt.answers,
      {
        option: action.option,
        xp:
          action.option === QUESTIONS[action.index].correct ? RULES.quizXP : 0,
        at: now,
      },
    ];
    next = finish({
      ...next,
      attempt: {
        ...attempt,
        answers,
        complete: answers.length === QUESTIONS.length,
        awaitingNext: true,
      },
    });
  }
  if (action.type === "next" && attempt?.awaitingNext && !attempt.complete)
    next = {
      ...next,
      attempt: {
        ...attempt,
        awaitingNext: false,
        deadline: now + RULES.questionMs,
      },
    };
  if (
    action.type === "predict" &&
    !next.entry &&
    !next.settled &&
    now < next.predictionDeadline &&
    ["Ember", "Kite"].includes(action.option)
  )
    next = { ...next, entry: { option: action.option, at: now } };
  if (action.type === "close" && now < next.predictionDeadline)
    next = {
      ...next,
      offset: next.offset + next.predictionDeadline - now,
      lastNow: next.predictionDeadline,
    };
  if (
    action.type === "settle" &&
    !next.settled &&
    now >= next.predictionDeadline
  ) {
    next = { ...next, settled: true };
    if (next.entry)
      next = addAward(
        next,
        guestAward(
          PREDICTION,
          next.entry.option === "Ember" ? RULES.predictionXP : 0,
        ),
      );
  }
  return next;
}
export function totals(state: DemoState, scope: Scope, league: League) {
  const sums = new Map<
    string,
    { id: string; name: string; xp: number; you: boolean }
  >();
  const key =
    league === "players" ? "user" : league === "teams" ? "team" : "country";
  PEOPLE.forEach((p) => {
    const id = key === "user" ? p.id : p[key];
    sums.set(id, {
      id,
      name: key === "user" ? p.name : id,
      xp: 0,
      you: id === (key === "user" ? GUEST : PEOPLE[0][key]),
    });
  });
  state.ledger
    .filter(
      (a) => a.season === SEASON && (scope === "season" || a.event === EVENT),
    )
    .forEach((a) => {
      const item = sums.get(a[key]);
      if (item) item.xp += a.xp;
    });
  const rows = [...sums.values()].sort(
    (a, b) => b.xp - a.xp || a.id.localeCompare(b.id),
  );
  return rows.map((row) => ({
    ...row,
    rank: 1 + rows.filter((r) => r.xp > row.xp).length,
  }));
}
export function guestXP(state: DemoState): number {
  return state.ledger
    .filter((a) => a.user === GUEST)
    .reduce((n, a) => n + a.xp, 0);
}
export function earnedXP(state: DemoState): number {
  return state.ledger
    .filter((a) => a.user === GUEST && [QUIZ, PREDICTION].includes(a.challenge))
    .reduce((n, a) => n + a.xp, 0);
}
