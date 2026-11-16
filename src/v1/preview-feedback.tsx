"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export function PreviewFeedback({
  client,
  tournamentId,
  signedIn,
}: {
  client: SupabaseClient;
  tournamentId: string;
  signedIn: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const form = new FormData(event.currentTarget);
    setState("sending");
    try {
      const { error } = await client.from("feedback").insert({
        tournament_id: tournamentId,
        rating: Number(form.get("rating")),
        comment: String(form.get("comment") ?? "").trim() || null,
      });
      if (error) throw error;
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <aside className="preview-edition" aria-label="Preview edition">
      <span>Preview edition · Help shape the game</span>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        Feedback
      </button>
      <dialog
        ref={dialog}
        className="top-fans-sheet"
        aria-labelledby="feedback-title"
      >
        <div className="top-fans-sheet-content panel">
          <h2 id="feedback-title">How’s the preview?</h2>
          {signedIn ? (
            state === "sent" ? (
              <p role="status">Thanks for helping shape BadmintonXP!</p>
            ) : (
              <form onSubmit={submit}>
                <label>
                  Rating
                  <select name="rating" defaultValue="" required>
                    <option value="" disabled>
                      Choose 1–5
                    </option>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating}>{rating}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Comment (optional)
                  <textarea name="comment" maxLength={500} rows={3} />
                </label>
                {state === "error" && (
                  <p role="alert">
                    We couldn’t save your feedback. Please try again.
                  </p>
                )}
                <button
                  type="submit"
                  className="primary"
                  disabled={state === "sending"}
                >
                  {state === "sending" ? "Sending…" : "Send feedback"}
                </button>
              </form>
            )
          ) : (
            <Link className="button primary" href="/play/account">
              Sign in to give feedback
            </Link>
          )}
          <form method="dialog">
            <button>Close</button>
          </form>
        </div>
      </dialog>
    </aside>
  );
}

type FeedbackRow = {
  id: string;
  user_id: string;
  tournament_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export function AdminFeedback({
  client,
  players,
  tournaments,
}: {
  client: SupabaseClient;
  players: { id: string; username: string }[];
  tournaments: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await client
          .from("feedback")
          .select("id,user_id,tournament_id,rating,comment,created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        if (active) setRows(data as FeedbackRow[]);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [client]);

  return (
    <section className="panel v1-admin-section">
      <h2>Preview feedback</h2>
      {failed ? (
        <p role="alert">
          Couldn’t load preview feedback. Refresh to try again.
        </p>
      ) : !rows ? (
        <p role="status">Loading feedback…</p>
      ) : !rows.length ? (
        <p>No preview feedback yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption>Latest preview feedback</caption>
            <thead>
              <tr>
                <th>Tournament</th>
                <th>Player</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {tournaments.find((t) => t.id === row.tournament_id)
                      ?.name ?? "Tournament"}
                  </td>
                  <td>
                    {players.find((p) => p.id === row.user_id)?.username ??
                      "Player"}
                  </td>
                  <td>{row.rating}/5</td>
                  <td className="feedback-comment">{row.comment || "—"}</td>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
