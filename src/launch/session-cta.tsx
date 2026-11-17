"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { v1Client } from "@/v1/client";
import { GameButton } from "@/v1/game-button";

type State = "checking" | "guest" | "fan" | "unavailable";
const LandingSession = createContext<State>("checking");

export function LandingSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void v1Client()
      .then((client) => {
        if (!active) return;
        if (!client) {
          setState("guest");
          return;
        }
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          if (active) setState(session ? "fan" : "guest");
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (active) setState("unavailable");
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return (
    <LandingSession.Provider value={state}>{children}</LandingSession.Provider>
  );
}

export function LandingCTA({ header = false }: { header?: boolean }) {
  const pathname = usePathname();
  const state = useContext(LandingSession);
  if (header && pathname !== "/") return null;
  const className = `launch-button launch-session-cta${header ? " launch-header-cta" : ""}`;
  if (state === "checking") {
    return (
      <span
        role="status"
        aria-label="Checking session"
        className={`${className} launch-cta-pending`}
      />
    );
  }
  return (
    <GameButton
      tone="primary"
      className={className}
      href={state === "guest" ? "/play/account?mode=signup" : "/play"}
    >
      {state === "fan"
        ? "ENTER THE ARENA"
        : state === "guest"
          ? "Register free"
          : "Open arena"}
    </GameButton>
  );
}
