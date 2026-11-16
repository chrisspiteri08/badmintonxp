"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Team } from "./types";
import { friendlyError } from "./client";

export type TeamInvite = Team & { invite_code: string; member_count: number };
type TeamResult = TeamInvite | { error: string } | { confirm_switch: true };

export async function teamAction(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<TeamResult> {
  const { data, error } = await client.rpc(name, args);
  if (error || !data) throw new Error(friendlyError(error));
  return data as TeamResult;
}

export function TeamPicker({
  teams,
  selected,
}: {
  teams: Team[];
  selected?: Team;
}) {
  const [choice, setChoice] = useState(selected ? "join" : "independent");
  const [search, setSearch] = useState("");
  const matches = teams.filter((team) =>
    team.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <fieldset className="team-picker">
      <legend>Team</legend>
      <div className="team-choices">
        {[
          ["join", "Join an existing team"],
          ["create", "Create a team"],
          ["independent", "Independent fan"],
        ].map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="team-choice"
              value={value}
              checked={choice === value}
              onChange={() => setChoice(value)}
            />
            {label}
          </label>
        ))}
      </div>
      {choice === "join" && (
        <>
          <label>
            Search teams
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            Choose a team
            <select name="team" required defaultValue={selected?.id ?? ""}>
              <option value="" disabled>
                {matches.length ? "Choose a team" : "No teams found"}
              </option>
              {matches.map((team) => (
                <option value={team.id} key={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {choice === "create" && (
        <label>
          Team name
          <input name="team-name" minLength={3} maxLength={30} required />
        </label>
      )}
    </fieldset>
  );
}

export function ShareTeam({
  team,
  created = false,
}: {
  team: TeamInvite;
  created?: boolean;
}) {
  const [fallback, setFallback] = useState(false);
  const [notice, setNotice] = useState("");
  const invite =
    typeof window === "undefined"
      ? ""
      : new URL(`/join/${team.invite_code}`, window.location.origin).href;
  const text = `Join my team ${team.name} on BadmintonXP 🏸 Free badminton quiz and predictions. Let's beat the world: ${invite}`;

  async function share() {
    if (!navigator.share) {
      setFallback(true);
      return;
    }
    try {
      await navigator.share({ title: team.name, text });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        setFallback(true);
    }
  }

  return (
    <section className="panel team-share" aria-label="Share team">
      <h2>
        {created ? "Your team is ready." : `Invite friends to ${team.name}`}
      </h2>
      <p>
        {created
          ? "Invite friends — your top 10 fans count."
          : "Your top 10 fans count."}
      </p>
      <button type="button" className="primary" onClick={() => void share()}>
        Share invite
      </button>
      {fallback && (
        <div className="team-share-options">
          <a
            className="button"
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite);
                setNotice("Invite link copied.");
              } catch {
                setNotice("Copy the invite link below.");
              }
            }}
          >
            Copy link
          </button>
          <a
            className="button"
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
          >
            X
          </a>
          <label>
            Invite link
            <input
              value={invite}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
    </section>
  );
}

export function YourTeam({
  client,
  team,
  teams,
  rank,
  onChange,
}: {
  client: SupabaseClient;
  team: TeamInvite | null;
  teams: Team[];
  rank?: number;
  onChange: (team: TeamInvite) => void;
}) {
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [share, setShare] = useState(false);
  const [newTeam, setNewTeam] = useState<TeamInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await teamAction(client, "v1_create_fan_team", {
        p_name: new FormData(event.currentTarget).get("name"),
      });
      if ("error" in result) setError(result.error);
      if ("id" in result) {
        setNewTeam(result);
        setMode(null);
        onChange(result);
      }
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel your-team" aria-label="Your team">
        <h2>Your team</h2>
        {team ? (
          <>
            <h3>{team.name}</h3>
            <p>
              {team.member_count}{" "}
              {team.member_count === 1 ? "member" : "members"} · Tournament rank{" "}
              {rank ? `#${rank}` : "—"}
            </p>
            {team.member_count < 10 && (
              <p>
                {team.member_count} of 10 scoring spots filled. Invite{" "}
                {10 - team.member_count} more.
              </p>
            )}
            <button
              type="button"
              className="primary"
              onClick={() => setShare(true)}
            >
              Invite friends
            </button>
          </>
        ) : (
          <div className="button-row">
            <button
              type="button"
              className="primary"
              onClick={() => {
                setError("");
                setMode("create");
              }}
            >
              Start a team
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode("join");
              }}
            >
              Join a team
            </button>
          </div>
        )}
        {mode === "create" && (
          <form onSubmit={create}>
            <label>
              Team name
              <input name="name" minLength={3} maxLength={30} required />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="primary" disabled={busy}>
              Create team
            </button>
          </form>
        )}
        {mode === "join" && (
          <div className="team-search">
            <label>
              Search teams
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <ul>
              {teams
                .filter(
                  (entry) =>
                    entry.name
                      .toLowerCase()
                      .includes(search.trim().toLowerCase()) &&
                    entry.invite_code,
                )
                .map((entry) => (
                  <li key={entry.id}>
                    <Link
                      className="button"
                      href={`/join/${entry.invite_code}`}
                    >
                      {entry.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>
      {(newTeam || (share && team)) && (
        <TeamShareDialog
          team={(newTeam || team)!}
          created={Boolean(newTeam)}
          onClose={() => {
            setNewTeam(null);
            setShare(false);
          }}
        />
      )}
    </>
  );
}

function TeamShareDialog({
  team,
  created,
  onClose,
}: {
  team: TeamInvite;
  created?: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="top-fans-sheet"
      aria-label="Team invite"
      onClose={onClose}
    >
      <ShareTeam team={team} created={created} />
      <form method="dialog">
        <button>Close</button>
      </form>
    </dialog>
  );
}

export function TeamSharePrompt({
  team,
  userId,
}: {
  team: TeamInvite;
  userId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [share, setShare] = useState(false);
  useEffect(() => {
    const now = new Date();
    const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const key = `badmintonxp-team-prompt:${userId}`;
    try {
      if (localStorage.getItem(key) === day) return;
      localStorage.setItem(key, day);
      setVisible(true);
    } catch {
      // Skip the prompt when its daily limit cannot be saved.
    }
  }, [userId]);
  return (
    <>
      {visible && (
        <aside className="panel team-prompt" aria-label="Invite your team">
          <button
            type="button"
            className="primary"
            onClick={() => {
              setShare(true);
              setVisible(false);
            }}
          >
            Invite your team
          </button>
          <button type="button" onClick={() => setVisible(false)}>
            Dismiss
          </button>
        </aside>
      )}
      {share && <TeamShareDialog team={team} onClose={() => setShare(false)} />}
    </>
  );
}

export function AdminFanTeams({ client }: { client: SupabaseClient }) {
  type Row = {
    id: string;
    name: string;
    creator: string;
    created_at: string;
    member_count: number;
  };
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [remove, setRemove] = useState<Row | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.resolve(client.rpc("v1_admin_fan_teams")).then(
      ({ data, error }) => {
        if (!active) return;
        if (error) setError("Couldn’t load fan-created teams.");
        else setRows(data as Row[]);
      },
    );
    return () => {
      active = false;
    };
  }, [client]);

  async function moderate(id: string, name: string | null) {
    setPending(true);
    setError("");
    try {
      const { error } = await client.rpc("v1_admin_moderate_team", {
        p_id: id,
        p_name: name,
      });
      if (error) throw error;
      setRows((previous) =>
        name === null
          ? (previous?.filter((team) => team.id !== id) ?? [])
          : (previous?.map((team) =>
              team.id === id ? { ...team, name: name.trim() } : team,
            ) ?? []),
      );
      setRemove(null);
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel v1-admin-section">
      <h2>Fan-created teams</h2>
      {error && <p role="alert">{error}</p>}
      {rows?.length === 0 && <p>No fan-created teams yet.</p>}
      {rows?.map((team) => (
        <form
          key={team.id}
          onSubmit={(event) => {
            event.preventDefault();
            void moderate(
              team.id,
              String(new FormData(event.currentTarget).get("name")),
            );
          }}
        >
          <p>
            {team.creator} · {team.member_count} members ·{" "}
            {new Date(team.created_at).toLocaleDateString()}
          </p>
          <label>
            Team name
            <input
              name="name"
              defaultValue={team.name}
              minLength={3}
              maxLength={30}
              required
            />
          </label>
          <div className="button-row">
            <button disabled={pending}>Rename</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setRemove(team)}
            >
              Delete
            </button>
          </div>
          {remove?.id === team.id && (
            <div role="group" aria-label="Confirm team deletion">
              <p>Delete {team.name} and close its invite link?</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => void moderate(team.id, null)}
              >
                Delete team
              </button>
              <button type="button" onClick={() => setRemove(null)}>
                Cancel
              </button>
            </div>
          )}
        </form>
      ))}
    </section>
  );
}
