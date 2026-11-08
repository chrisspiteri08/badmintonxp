"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { z } from "zod";
import {
  act,
  freshState,
  STORE_KEY,
  type Action,
  type DemoState,
} from "./model";

const stamp = z.number().finite().nonnegative();
const schema = z
  .object({
    version: z.literal(1),
    createdAt: stamp,
    lastNow: stamp,
    offset: stamp,
    predictionDeadline: stamp,
    entry: z
      .object({ option: z.enum(["Ember", "Kite"]), at: stamp })
      .nullable(),
    settled: z.boolean(),
    attempt: z
      .object({
        answers: z
          .array(
            z.object({
              option: z.number().int().min(0).max(3).nullable(),
              xp: z.union([z.literal(0), z.literal(10)]),
              at: stamp,
            }),
          )
          .max(3),
        deadline: stamp,
        awaitingNext: z.boolean(),
        complete: z.boolean(),
      })
      .nullable(),
    ledger: z.array(
      z.object({
        id: z.string(),
        user: z.string(),
        challenge: z.string(),
        event: z.string(),
        season: z.string(),
        team: z.string(),
        country: z.string(),
        xp: z.number().int().nonnegative(),
      }),
    ),
  })
  .refine(
    (s) =>
      new Set(s.ledger.map((a) => a.id)).size === s.ledger.length &&
      (!s.attempt || s.attempt.complete === (s.attempt.answers.length === 3)),
  );
function read(): DemoState {
  const raw = localStorage.getItem(STORE_KEY);
  return raw ? schema.parse(JSON.parse(raw)) : freshState(Date.now());
}
type Context = {
  state: DemoState | null;
  error: string;
  dispatch: (a: Action) => Promise<void>;
  reset: () => Promise<void>;
};
const Store = createContext<Context | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState("");
  const transact = useCallback(async (action?: Action, reset = false) => {
    const run = () => {
      try {
        const next = reset
          ? freshState(Date.now())
          : act(read(), action || { type: "tick" }, Date.now());
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
        setState(next);
        setError("");
      } catch {
        setError(
          "Local demo data could not be read or saved. Enable browser storage, or use Full demo reset to clear incompatible data. Progress has not been silently reset.",
        );
      }
    };
    // Serialize read → validate → write across tabs as well as rapid taps.
    if (navigator.locks) await navigator.locks.request(STORE_KEY, run);
    else run();
  }, []);
  useEffect(() => {
    void transact();
    const timer = setInterval(() => void transact(), 250);
    const sync = (e: StorageEvent) => {
      if (e.key === STORE_KEY) {
        try {
          setState(read());
        } catch {
          setError("Local demo data is incompatible. Use Full demo reset.");
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, [transact]);
  return (
    <Store.Provider
      value={{
        state,
        error,
        dispatch: (a) => transact(a),
        reset: () => transact(undefined, true),
      }}
    >
      {children}
    </Store.Provider>
  );
}
export function useDemo() {
  const value = useContext(Store);
  if (!value) throw new Error("DemoProvider required");
  return value;
}
