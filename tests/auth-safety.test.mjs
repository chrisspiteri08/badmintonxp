import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function parse(file) {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function nodes(tree, predicate) {
  const result = [];
  function visit(node) {
    if (predicate(node)) result.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}
test("login has no credential literals, account provisioning shortcut, or profile writes", () => {
  const tree = parse("src/app/(legacy)/login/page.tsx");
  const calls = nodes(tree, ts.isCallExpression);
  const provisionCalls = calls.filter((c) =>
    c.expression.getText(tree).includes("signUpUser"),
  );
  // Only the regular, user-submitted player form may request signup.
  assert.equal(provisionCalls.length, 1);
  assert.equal(provisionCalls[0].arguments.length, 2);
  assert.equal(
    calls.some((c) =>
      /\.auth\.|\.from$|\.update$/.test(c.expression.getText(tree)),
    ),
    false,
  );
  assert.equal(
    nodes(
      tree,
      (n) =>
        ts.isVariableDeclaration(n) &&
        /admin.*(?:password|email)|handleAdminLogin/i.test(
          n.name.getText(tree),
        ),
    ).length,
    0,
  );
  assert.equal(
    nodes(
      tree,
      (n) =>
        ts.isPropertyAssignment(n) &&
        n.name.getText(tree) === "password" &&
        ts.isStringLiteral(n.initializer),
    ).length,
    0,
  );
});
test("public signup exposes no admin flag and seed passwords are not shared literals", () => {
  const auth = parse("src/contexts/auth-context.tsx");
  const roleAssignments = nodes(
    auth,
    (n) => ts.isPropertyAssignment(n) && n.name.getText(auth) === "role",
  );
  assert.equal(roleAssignments.length, 1);
  assert.equal(
    roleAssignments.every(
      (n) =>
        ts.isStringLiteral(n.initializer) && n.initializer.text === "player",
    ),
    true,
  );
  assert.equal(
    nodes(auth, (n) => ts.isIdentifier(n) && n.text === "isAdmin").length,
    0,
  );
  const seed = parse("src/app/(legacy)/admin/settings/page.tsx");
  assert.equal(
    nodes(
      seed,
      (n) =>
        ts.isVariableDeclaration(n) &&
        n.name.getText(seed) === "password" &&
        n.initializer &&
        ts.isStringLiteral(n.initializer),
    ).length,
    0,
  );
});
