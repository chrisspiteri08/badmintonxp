import { tournamentPublicationHeld } from "./domain";
import type { AdminData, Quiz, Tournament } from "./types";
export function quizPublishIssues(quiz: Quiz, data: AdminData): string[] {
  const questions = data.questions
    .filter((q) => q.quiz_id === quiz.id)
    .sort((a, b) => a.position - b.position);
  const issues: string[] = [];
  if (!questions.length) issues.push("Add at least one question.");
  else if (questions.some((q, i) => q.position !== i))
    issues.push(
      "Number questions consecutively from 1; edit or remove the out-of-order question.",
    );
  if (
    questions.some(
      (q) =>
        q.options.length !== 4 ||
        !q.options.every((o) => o.trim()) ||
        !Number.isInteger(q.correct_option) ||
        q.correct_option < 0 ||
        q.correct_option > 3 ||
        !q.explanation.trim(),
    )
  )
    issues.push(
      "Every question needs four answers, one correct answer and an explanation.",
    );
  return issues;
}
export function tournamentPublishIssues(
  t: Tournament,
  data: AdminData,
): string[] {
  const issues: string[] = [];
  if (tournamentPublicationHeld(t.name))
    issues.push(
      "World Tour Finals 2026 is on owner hold. Only a separate owner-approved release can lift it.",
    );
  if (!data.matches.some((m) => m.tournament_id === t.id))
    issues.push("Add at least one match.");
  if (!data.quizzes.some((q) => q.tournament_id === t.id && q.published))
    issues.push("Publish at least one quiz for this tournament.");
  return issues;
}
