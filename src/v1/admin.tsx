"use client";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminData } from "./types";
import { tournamentPublicationHeld } from "./domain";
export function Admin({
  client,
  busy,
  perform,
  onSaved,
}: {
  client: SupabaseClient;
  busy: boolean;
  perform: (task: () => Promise<void>) => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const [data, setData] = useState<AdminData | null>(null);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<{ id: string; winner: string } | null>(
    null,
  );
  const load = useCallback(async () => {
    const { data, error } = await client.rpc("v1_admin_snapshot");
    if (error) throw error;
    setData(data as AdminData);
  }, [client]);
  useEffect(() => {
    void perform(load);
  }, [perform, load]);
  const save = (kind: string, fields: Record<string, unknown>) =>
    perform(async () => {
      const { error } = await client.rpc("v1_admin_save", {
        p_kind: kind,
        p_data: fields,
      });
      if (error) throw error;
      await load();
      await onSaved();
      setNotice(
        kind.startsWith("publish")
          ? "Published. Fans can now play."
          : "Saved as a draft. Review it before publishing.",
      );
    });
  const submit = (kind: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget),
    );
    for (const key of ["starts_at", "ends_at", "opens_at", "closes_at"])
      if (fields[key])
        fields[key] = new Date(String(fields[key])).toISOString();
    if (kind === "question") {
      fields.options = [fields.a, fields.b, fields.c, fields.d];
      fields.correct_option = Number(fields.correct_option) - 1;
      fields.position = Number(fields.position) - 1;
      delete fields.a;
      delete fields.b;
      delete fields.c;
      delete fields.d;
    }
    void save(kind, fields);
  };
  const form = (title: string, kind: string, children: ReactNode) => (
    <details className="panel v1-admin-section">
      <summary>{title}</summary>
      <form onSubmit={submit(kind)}>
        {children}
        <button className="primary" disabled={busy}>
          Save {kind}
        </button>
      </form>
    </details>
  );
  const draftTournaments = data?.tournaments.filter((t) => !t.published) || [];
  const draftQuizzes = data?.quizzes.filter((q) => !q.published) || [];
  const tournamentSelect = (
    <label>
      Tournament
      <select name="tournament_id" required>
        <option value="">Choose a draft tournament</option>
        {draftTournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="v1-admin">
      <span className="eyebrow">TOURNAMENT DESK</span>
      <h1>Set the stage.</h1>
      <p>
        Create a season and tournament, add matches and a quiz, then publish
        when the details are confirmed. All times below use your device’s
        timezone.
      </p>
      {notice && (
        <p role="status" className="v1-notice">
          {notice}
        </p>
      )}
      {!data ? (
        <p>Loading the tournament desk…</p>
      ) : (
        <>
          {form(
            "1. Create a season",
            "season",
            <label>
              Season name
              <input name="name" minLength={2} maxLength={80} required />
            </label>,
          )}
          {form(
            "2. Create a team",
            "team",
            <label>
              Team name
              <input name="name" minLength={2} maxLength={40} required />
            </label>,
          )}
          {form(
            "3. Create a tournament",
            "tournament",
            <>
              <label>
                Tournament name
                <input name="name" minLength={2} maxLength={100} required />
              </label>
              <label>
                Season
                <select name="season_id" required>
                  <option value="">Choose a season</option>
                  {data.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tournament starts
                <input type="datetime-local" name="starts_at" required />
              </label>
              <label>
                Tournament ends
                <input type="datetime-local" name="ends_at" required />
              </label>
            </>,
          )}
          {form(
            "4. Add a match",
            "match",
            <>
              {tournamentSelect}
              <label>
                First athlete or pair
                <input name="athlete_a" minLength={2} maxLength={80} required />
              </label>
              <label>
                Second athlete or pair
                <input name="athlete_b" minLength={2} maxLength={80} required />
              </label>
              <label>
                Predictions close
                <input type="datetime-local" name="closes_at" required />
              </label>
            </>,
          )}
          {form(
            "5. Create a quiz",
            "quiz",
            <>
              {tournamentSelect}
              <label>
                Quiz title
                <input name="title" minLength={2} maxLength={100} required />
              </label>
              <label>
                Quiz opens
                <input type="datetime-local" name="opens_at" required />
              </label>
              <label>
                Quiz entries close
                <input type="datetime-local" name="closes_at" required />
              </label>
            </>,
          )}
          {form(
            "6. Write a quiz question",
            "question",
            <>
              <label>
                Quiz
                <select name="quiz_id" required>
                  <option value="">Choose a draft quiz</option>
                  {draftQuizzes.map((q) => (
                    <option value={q.id} key={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Question number
                <input
                  type="number"
                  name="position"
                  min={1}
                  max={50}
                  required
                />
              </label>
              <label>
                Question
                <textarea
                  name="prompt"
                  minLength={5}
                  maxLength={500}
                  required
                />
              </label>
              {["a", "b", "c", "d"].map((key, i) => (
                <label key={key}>
                  Answer {i + 1}
                  <input name={key} maxLength={200} required />
                </label>
              ))}
              <label>
                Correct answer
                <select name="correct_option" required>
                  {[1, 2, 3, 4].map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
              <label>
                Explanation
                <textarea name="explanation" maxLength={1000} required />
              </label>
            </>,
          )}
          <section className="panel v1-admin-section">
            <h2>7. Review & publish</h2>
            <p>
              Publishing locks the questions and fixture details. Results are
              final once confirmed.
            </p>
            {data.quizzes.map((q) => (
              <div className="v1-review" key={q.id}>
                <h3>
                  {q.title} · {q.published ? "Published" : "Draft"}
                </h3>
                <ol>
                  {data.questions
                    .filter((question) => question.quiz_id === q.id)
                    .sort((a, b) => a.position - b.position)
                    .map((question) => (
                      <li key={question.id}>
                        <strong>
                          {question.position + 1}. {question.prompt}
                        </strong>
                        <span>{question.options.join(" / ")}</span>
                        <span>
                          Correct: {question.options[question.correct_option]} ·{" "}
                          {question.explanation}
                        </span>
                      </li>
                    ))}
                </ol>
                {!q.published && (
                  <button
                    disabled={busy}
                    onClick={() => void save("publish_quiz", { id: q.id })}
                  >
                    Publish quiz: {q.title}
                  </button>
                )}
              </div>
            ))}
            {data.tournaments.map((t) => (
              <div className="v1-review" key={t.id}>
                <h3>
                  {t.name} ·{" "}
                  {t.active
                    ? "Current event"
                    : t.published
                      ? "Published"
                      : "Draft"}
                </h3>
                <p>
                  {new Date(t.starts_at).toLocaleString()} –{" "}
                  {new Date(t.ends_at).toLocaleString()}
                </p>
                <ul>
                  {data.matches
                    .filter((m) => m.tournament_id === t.id)
                    .map((m) => (
                      <li key={m.id}>
                        {m.athlete_a} vs {m.athlete_b} · Predictions close{" "}
                        {new Date(m.closes_at).toLocaleString()}
                      </li>
                    ))}
                </ul>
                {!t.published && (
                  <button
                    className="primary"
                    disabled={busy || tournamentPublicationHeld(t.name)}
                    onClick={() =>
                      void save("publish_tournament", { id: t.id })
                    }
                  >
                    {tournamentPublicationHeld(t.name)
                      ? `Publication on hold: ${t.name}`
                      : `Publish tournament: ${t.name}`}
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="panel v1-admin-section">
            <h2>Enter match results</h2>
            <p>
              Wait until predictions close. Confirming the winner awards XP once
              and cannot be undone.
            </p>
            {data.matches.map((m) => (
              <div className="v1-review" key={m.id}>
                <h3>
                  {m.athlete_a} vs {m.athlete_b}
                </h3>
                {m.winner ? (
                  <p>Final: {m.winner} wins.</p>
                ) : (
                  <div className="button-row">
                    {[m.athlete_a, m.athlete_b].map((winner) => (
                      <button
                        disabled={busy}
                        key={winner}
                        onClick={() => setResult({ id: m.id, winner })}
                      >
                        {winner} wins
                      </button>
                    ))}
                  </div>
                )}
                {result?.id === m.id && (
                  <div
                    className="reset-confirm"
                    role="group"
                    aria-label="Confirm match result"
                  >
                    <p>
                      Confirm {result.winner} as the winner? This result is
                      final.
                    </p>
                    <div className="button-row">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            const { error } = await client.rpc(
                              "v1_settle_match",
                              { p_match_id: m.id, p_winner: result.winner },
                            );
                            if (error) throw error;
                            setResult(null);
                            await load();
                            await onSaved();
                            setNotice(
                              "Result confirmed. Scores and rankings are updated.",
                            );
                          })
                        }
                      >
                        Confirm winner
                      </button>
                      <button autoFocus onClick={() => setResult(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
          <section className="panel v1-admin-section">
            <h2>Players</h2>
            <div className="table-wrap">
              <table>
                <caption>Registered players · Admin only</caption>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Country</th>
                    <th>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">{p.username}</th>
                      <td>{p.email}</td>
                      <td>{p.country}</td>
                      <td>{p.team_id || "Independent"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
