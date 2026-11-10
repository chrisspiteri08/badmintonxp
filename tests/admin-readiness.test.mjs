import { test } from "node:test";
import assert from "node:assert/strict";
// Transpile the small pure module to resolve repo TypeScript imports under Node.
import ts from "typescript";
import { readFileSync } from "node:fs";
import { tournamentPublicationHeld } from "../src/v1/domain.ts";
const source = readFileSync("src/v1/admin-readiness.ts", "utf8").replace(
  'import { tournamentPublicationHeld } from "./domain";',
  "",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exported = {};
new Function("exports", "tournamentPublicationHeld", js)(
  exported,
  tournamentPublicationHeld,
);
const { quizPublishIssues, tournamentPublishIssues } = exported;
test("publish readiness explains missing matches/quizzes and the intentional owner hold", () => {
  const t = { id: "t", name: "World Tour Finals 2026" };
  const data = { matches: [], quizzes: [] };
  assert.equal(tournamentPublishIssues(t, data).length, 3);
  assert.match(tournamentPublishIssues(t, data)[0], /owner hold/);
  assert.deepEqual(
    tournamentPublishIssues(
      { id: "t", name: "Another event" },
      {
        matches: [{ tournament_id: "t" }],
        quizzes: [{ tournament_id: "t", published: true }],
      },
    ),
    [],
  );
});
test("quiz readiness distinguishes empty quizzes, numbering gaps and answer completeness", () => {
  const quiz = { id: "q" };
  const data = { questions: [] };
  assert.match(quizPublishIssues(quiz, data)[0], /at least one/);
  const q = {
    quiz_id: "q",
    position: 1,
    options: ["A", "B", "C", "D"],
    correct_option: 0,
    explanation: "A",
  };
  assert.match(
    quizPublishIssues(quiz, { questions: [q] })[0],
    /consecutively from 1/,
  );
  assert.deepEqual(
    quizPublishIssues(quiz, { questions: [{ ...q, position: 0 }] }),
    [],
  );
  assert.match(
    quizPublishIssues(quiz, {
      questions: [{ ...q, position: 0, correct_option: 4 }],
    })[0],
    /correct answer/,
  );
});
