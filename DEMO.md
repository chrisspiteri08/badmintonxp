# BadmintonXP guest demo

Local-only implementation of the supplied `CODEX_TASK.md`. Approved handoff artwork and the Canvas prototype informed visual composition; the prototype's scoring/state logic was not copied.

## Run

Use Node 22.18+ (actual checks used Node 26.7.0 and npm 11.19.0).

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run dev:demo
```

Open http://127.0.0.1:3100/demo (not the legacy `/` login redirect).

Routes: `/demo`, `/demo/quiz`, `/demo/prediction`, `/demo/standings`, `/demo/progress`.
No `.env`, credentials, database access, provider setup or accounts are needed.
If port 3100 is occupied, stop the prior demo server or use `npx next dev --hostname 127.0.0.1 --port 3101`.

## Boundaries and preservation

The root layout only provides the document shell and shared base CSS. Existing pages were moved, without changing their URLs, into `(legacy)` with their original auth provider/toaster/font layout. The guest subtree never mounts that provider or imports the Supabase client. Existing routes/data logic were not repaired or tested against a backend. Existing exposed admin credentials need owner rotation; values are intentionally not reproduced here. Database policies and profile triggers remain unverified.

Development output uses `.next-dev`; production uses `.next`, so browser checks and a build cannot corrupt each other's artifacts. Build TypeScript/lint suppression is explicitly disabled. The full application still has pre-existing validation failures; `typecheck:demo` is a separate, strict check of the new demo, not a substitute for full-project checks.

## Provisional demo rules

Constants and fixtures are centralized in `src/demo/model.ts`; these are not final owner-approved rules.

- Correct quiz answer: 10 XP; wrong or timeout: 0. Three questions, 15 seconds each, no speed bonus. First tap locks; final answer score is awarded synchronously. One attempt, including direct routes/reloads. Only full reset permits replay.
- Persisted absolute deadlines continue through navigation, reload and remount. Unanswered questions have consecutive 15-second windows and catch up on return, potentially timing out the whole remaining quiz. A locked answer waits for Continue; Continue starts the next question exactly once.
- One prediction, strictly before its displayed UTC deadline. Entry: 0 XP. Correct fixed simulated result (Ember): 20; wrong: 0. Closing entries advances the local clock to the deadline and also expires running quiz questions. Settlement cannot happen before closure and can award only once. No real results, prizes, stakes or live feeds.
- One versioned local store, `badmintonxp:guest:v1`, with schema validation, stable award IDs and a monotonic time high-water mark. Unsupported/corrupt data shows an error instead of silently resetting. Storage errors are shown; writable browser storage is required.
- A single ledger drives all profile/home/individual/team/country totals. Each award records user, challenge, event, season, fixed team and fixed country. Event attribution follows the challenge, never settlement/revisit date. Team/country switching is deferred.
- Guest starts with 40 current-event XP and 100 earlier-event XP. Rival fixtures are also attributed ledger awards. Event and season filters therefore differ without resetting lifetime XP. Teams/countries sum awards once; this is not an approved team-size fairness rule.
- Ties share competition rank. Stable ID ordering is display-only, not prize tie-breaking. Monthly/yearly cadence is undecided.
- This is editable, browser-local demo state, not trustworthy competition state. Web Locks serialize local transactions across supporting browser tabs; fallback browsers serialize in one JS context only. Clearing browser storage also removes all progress.

## Tests

```sh
npm test                  # pure state/ledger tests, using Node's TS support
npm run typecheck:demo     # strict new-demo TypeScript, no suppression
npm run lint:demo          # new-demo lint
npm run typecheck          # full project; known existing failures
npm run lint               # full project; known existing failures
npm run build              # full production build; checks enabled
npm run test:e2e            # server already running on port 3100; installed Chrome
```

Playwright uses installed Google Chrome. Browser projects cover 360×800 and 1440×1000. Set `DEMO_SCREENSHOT_DIR` to choose a screenshot directory; default is `../../outputs/screenshots` relative to the checkout. E2E verifies actual interactions, first-tap locking, correct/wrong/timeout scores, reload clocks, replay blocking, prediction locking/settlement, event/season/group sums, home/table agreement, keyboard input, reduced-motion mode, incompatible-store recovery, no horizontal overflow, no browser exceptions and no external requests in the full journey. It uses Playwright's browser clock to test elapsed time without waiting 45 real seconds. It does not call backend services.

## Production limitations

No real accounts, referrals, shared competition, membership changes, trusted time, server-side answer secrecy, authoritative awards, live fixtures, live settlement, anti-cheat, sponsor affiliation or giveaways. All of those need a separately designed and verified backend. Existing production flows remain legacy code, with their existing security and validation issues. No push, deployment, provider configuration or database policy changes are part of this branch.
