"use client";
import { GameBurst } from "@/v1/game-ui";
import { GameButton } from "@/v1/game-button";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError, v1Client } from "@/v1/client";
import { teamAction, type TeamInvite } from "@/v1/fan-teams";

export function JoinTeam({ team }: { team: TeamInvite | null }) {
  const [auth, setAuth] = useState<{
    client: SupabaseClient | null;
    signedIn: boolean;
  }>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [joined, setJoined] = useState<TeamInvite | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!team) return;
    let active = true;
    void (async () => {
      try {
        const client = await v1Client();
        const session = await client?.auth.getSession();
        if (session?.error) throw session.error;
        if (active)
          setAuth({ client, signedIn: Boolean(session?.data.session) });
      } catch {
        if (active) setError("Couldn’t open the invitation. Please try again.");
      }
    })();
    return () => {
      active = false;
    };
  }, [team]);

  async function join(switchTeam: boolean) {
    if (!team || !auth?.client) return;
    setBusy(true);
    setError("");
    try {
      const result = await teamAction(auth.client, "v1_join_fan_team", {
        p_code: team.invite_code,
        p_confirm_switch: switchTeam,
      });
      if ("error" in result) setError(result.error);
      if ("confirm_switch" in result) setConfirm(true);
      if ("id" in result) setJoined(result);
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demo v1 team-invite-page">
      <main className="panel game-burst-host" data-panel="team">
        {joined && <GameBurst />}
        <span className="eyebrow">BADMINTONXP · TEAM INVITE</span>
        {team ? (
          <>
            <h1>{team.name}</h1>
            <p>
              {(joined ?? team).member_count}{" "}
              {(joined ?? team).member_count === 1 ? "member" : "members"}
            </p>
            {joined ? (
              <>
                <p role="status">You’re on {joined.name}.</p>
                <GameButton className="button primary" href="/play">
                  Enter the arena
                </GameButton>
              </>
            ) : auth?.signedIn ? (
              confirm ? (
                <div role="group" aria-label="Confirm team switch">
                  <p>
                    Switch to {team.name}? XP you’ve already earned stays with
                    your previous team.
                  </p>
                  <GameButton
                    className="primary"
                    disabled={busy}
                    onClick={() => void join(true)}
                  >
                    Switch team
                  </GameButton>
                  <GameButton disabled={busy} onClick={() => setConfirm(false)}>
                    Cancel
                  </GameButton>
                </div>
              ) : (
                <GameButton
                  className="primary"
                  disabled={busy}
                  onClick={() => void join(false)}
                >
                  Join {team.name}
                </GameButton>
              )
            ) : auth ? (
              <GameButton
                className="button primary"
                href={`/play/account?mode=signup&team=${team.id}&invite=${team.invite_code}`}
              >
                Join {team.name}
              </GameButton>
            ) : (
              !error && <p role="status">Opening your invitation…</p>
            )}
            {error && <p role="alert">{error}</p>}
          </>
        ) : (
          <>
            <h1>Team invitation unavailable</h1>
            <GameButton className="button primary" href="/play">
              Back to the arena
            </GameButton>
          </>
        )}
      </main>
    </div>
  );
}
