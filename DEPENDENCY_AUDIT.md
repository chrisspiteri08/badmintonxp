# Dependency remediation — 9 November 2026

Scope: `feature/v1-accounts-server-scoring-20261109`. No main merge, hosting deployment, preview update, DNS change or Supabase cloud change.

## Audit results

| Audit | Before | After |
| --- | --- | --- |
| Production (`npm audit --omit=dev`) | 52: 4 critical, 21 high, 26 moderate, 1 low | 0 |
| Complete dependency tree (`npm audit`) | Included vulnerable development chains | 0 |

There are no remaining npm-reported findings at this check. This result uses the registry's current advisory database, not an advisory ignore list. `npm run audit:production` exits nonzero for any finding, including low severity.

## Changes and rationale

- Removed unused `firebase`, `@tanstack-query-firebase/react`, `patch-package` and `dotenv`. Application/source searches found no callers; patch-package had no patches or lifecycle hook. This removes vulnerable websocket/protobuf and other dependency chains rather than hiding them under devDependencies.
- Removed the unused Genkit runtime, Google provider, Next integration and CLI (`genkit`, `@genkit-ai/googleai`, `@genkit-ai/next`, `genkit-cli`). There were no AI flows or application imports. The two original bootstrap files remain verbatim in `archive/ai/*.ts.txt`. Both quiz systems use manual/local questions. This removes vulnerable Handlebars, Express/proxy and telemetry chains without downgrading to an incompatible AI SDK.
- Upgraded Zod from 3.24.2 to **4.6.7** to address its constrained-collection validation denial-of-service advisory. Guest store data shape and scoring behavior are unchanged. Upgraded `@hookform/resolvers` to **5.9.2** and React Hook Form to **7.91.0** for compatible form types and peers. All existing TypeScript checks remain enabled.
- Upgraded PostCSS to **8.5.32**. Next 15.5.29 pins old PostCSS, so the root manifest uses `overrides.postcss = "$postcss"` to use the patched 8.x version consistently. Next remains on 15.5.29; no framework major upgrade was needed. The cPanel packager copies the exact audited PostCSS version into its generated manifest's override, avoiding a vulnerable re-install on the host.
- Updated compatible lockfile dependencies with `npm audit fix` (no `--force`). Sucrase **3.35.1** replaces its affected glob chain with tinyglobby, clearing the last production moderate chain. No build tool was moved out of production merely to reduce the count.
- Scoped an override to `@typescript-eslint/typescript-estree`'s **minimatch >=11.0.1**, addressing the remaining development-only matching denial-of-service advisory. It preserves the named `Minimatch` API used by the installed parser; strict ESLint, TypeScript and Next build verify compatibility on Node 22. Other packages' older compatible minimatch major versions were left alone when not affected.

## Verification

Actual final verification on Node 22.23.4:

| Check | Result |
| --- | --- |
| Clean `npm ci` | Passed |
| Unit / embedded PostgreSQL scoring, RLS, roles, readiness and health tests | 39 passed |
| Real local Supabase Auth/RLS/concurrency, content-role and hold tests | 8 passed |
| Typecheck and strict ESLint | Passed |
| Secret-free Next 15.5.29 standalone production build | Passed |
| Guest, redirects, visitor privacy, caption and health browser checks at 360px / 1440px | 18 passed |
| V1 account/admin/content-editor browser scenarios at 360px / 1440px | 8 passed |
| Independently installed cPanel runtime audit | 0 findings |
| Root production audit / full audit | 0 / 0 findings |

The browser suites ran against app.js in a clean package copy with only its declared runtime dependencies. They include real local email confirmation/recovery, correct/wrong scoring, persistence, actual server-clock timeouts, repeated settlement, public rankings, admin-role rejection and unpublished admin drafts. No scoring rules or expected XP values were changed.

The Supabase project used for testing is disposable/local only. No real tournament or cloud deployment is published. The branch is pushed without merging; deployments remain owner-controlled. Supersede any earlier ZIP whose runtime manifest lacks the PostCSS override.

## Reproduce

Use Node 22 and the committed lockfile:

```sh
npm ci
npm audit --omit=dev
npm audit
npm test
npm run typecheck
npm run lint
npm run build:cpanel
npm run package:v1
```

For Auth/API/browser coverage, use the local Supabase steps in `V1_SETUP.md`. The generated package should also report zero findings after its own clean `npm ci` and `npm audit --omit=dev`.

## Upstream references

- [Zod 4 migration guide](https://zod.dev/v4/changelog)
- [PostCSS 8.5.32 release](https://github.com/postcss/postcss/releases/tag/8.5.32)
- [PostCSS source-map advisory and patched version](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)
- [Resolver v5 form peer requirements](https://github.com/react-hook-form/resolvers/releases/tag/v5.0.0)

Main-domain packaging update: `/` now redirects to `/play`, www callbacks redirect to HTTPS apex with query parameters preserved, and World Tour Finals 2026 has a database publication hold. These changes were verified in the current test counts above; cloud email, SSL/alias routing and actual upload remain owner verification steps.

Visitor-fix verification (10 November 2026): friendly fallback messages and legacy redirects expose no development setup text; the missing-event caption has no leading separator. `/api/health` was verified with an available local DB (200, true) and after its shutdown (503, false), with no diagnostic payload. No additional SQL migration is required for this update.

Content-editor update (10 November 2026): readiness checklists, safe draft-question corrections and least-privilege content management were verified with the updated test counts above. Existing v1 databases require the dedicated content-editor upgrade migration before the updated desk is used.
