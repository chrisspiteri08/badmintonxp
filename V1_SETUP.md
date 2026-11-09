# BadmintonXP v1: isolated test setup

This branch adds `/play` (real accounts and database scores). `/demo` stays a fictional, browser-local guest game. `/` still redirects to `/demo`. Nothing in this guide requires changing badmintonxp.com or its production Supabase project.

## What the owner needs to provide/configure

Create a **new Supabase project named BadmintonXP-v1-test**, in an Asia region near the intended players (Singapore is a sensible choice). Keep its database password in your password manager. Use a separate test-site hostname or a platform-generated test URL. Tell the developer only the test hostname, project name/reference, intended first admin email, and confirmed tournament name/dates/season. **Do not paste passwords, API keys, database connection strings or service keys into chat.** The app needs no service-role key.

Configure these runtime environment variables yourself in the test site's hosting control panel:

| Variable | Where its value comes from |
| --- | --- |
| `V1_ISOLATED_TEST_PROJECT` | Set to `true` only on this isolated test site |
| `V1_SUPABASE_URL` | New test project's Project URL |
| `V1_SUPABASE_PUBLISHABLE_KEY` | New test project's publishable key (or legacy anon key); never a secret/service-role key |

These values are intentionally not in source files or the upload package. The public project URL and publishable key are delivered at runtime by `/api/v1/config`; this is normal Supabase browser configuration. Database RLS and guarded functions enforce access. The configuration endpoint rejects service-role JWTs and modern secret keys. It does not use the legacy `NEXT_PUBLIC_SUPABASE_*` settings. The explicit flag cannot identify a project for you: double-check that you selected the new test project.

## Supabase Dashboard, step by step

1. In Supabase, create the new project. Do not select the existing production project. Wait until the new project's database is ready.
2. Open **SQL Editor → New query** in that new project. Paste and run `supabase/migrations/202611090001_v1.sql` from this branch. Run it once, as a migration, on the empty project. Do not disable RLS or grant direct client writes to fix an error. If you use the Supabase CLI instead, link only this new test project and run `supabase db push`; inspect the selected project before approving.
3. Open **Authentication → Sign In / Providers → Email**. Enable email/password sign-up and **Confirm email**. Set minimum password length to **12**. Leave anonymous sign-ins off. Configure password recovery/email delivery.
4. Under **Authentication → URL Configuration**, set Site URL to `https://YOUR-TEST-HOST/play`. Add these exact redirect URLs: `https://YOUR-TEST-HOST/play/account` and `https://YOUR-TEST-HOST/play/reset`. Add localhost equivalents only if you will use that separate cloud project locally. Avoid wildcard production redirects.
5. Under authentication email/SMTP settings, configure a sender you control for sending confirmation and reset messages to real testers. Supabase's built-in email sender has delivery restrictions and rate limits; verify delivery before inviting players. Configure Auth rate limits appropriately, and enable supported bot protection before opening sign-up broadly.
6. Leave the Data API enabled for **public**. Do **not** add `private` to exposed schemas. No Storage buckets, live data feed, Edge Functions, Google OAuth or service-role environment variable are needed. Google sign-in is deferred because it requires separate provider credentials and redirect setup.
7. Open the test site's `/play/account`, sign up with your intended admin email, follow its confirmation link in the same browser, and save the player profile.
8. In that **test project's SQL Editor**, replace the email placeholder below and run it. This is the only admin bootstrap; no automatic admin creation or promotion exists:

   ```sql
   insert into private.admins(user_id)
   select id from auth.users
   where lower(email) = lower('YOUR-CONFIRMED-ADMIN-EMAIL')
     and email_confirmed_at is not null
   on conflict do nothing;
   ```

   Check that one row was inserted, or verify the existing membership with a SQL Editor query. A profile field or user-editable Auth metadata cannot grant admin rights. Refresh the profile page and open **Tournament admin** (`/play/admin`). To revoke a role, remove that user's membership from `private.admins` in SQL Editor.

## Add the first real tournament, keeping it unpublished

No real tournament has been invented or pre-published. The account arena starts empty.

1. Open `/play/admin`. Expand **Create a season** and save the season name.
2. Create the teams players may join.
3. Create the tournament with its confirmed name, season and start/end times. Inputs use your device's timezone; dates are stored in UTC.
4. Add its matches with the actual athletes/pairs. Set each prediction deadline before play begins. Do not publish an unconfirmed fixture list.
5. Create its quiz, including when players may start it. Add each question in consecutive order starting at question number 1, four answers, one correct answer and an explanation.
6. Review the questions and fixture details. **Stop here to keep the tournament unpublished.** Draft data and answer keys are admin-only.
7. Once the owner approves all details, publish the quiz, then publish the tournament. Publishing the tournament makes it the single current event. Published questions/fixtures are frozen; v1 does not provide correction/reversal tools. Carefully review drafts before publishing.
8. After a match's prediction deadline passes and its real result is verified, select the winner in **Enter match results** and confirm. A result is final; repeated settlement with the same winner is harmless and never awards twice. Conflicting results are rejected.

## Test copy on cPanel (separate from the live site)

1. Ask the host for a separate test hostname/document root, or create one in cPanel **Domains**. Do not reuse badmintonxp.com's current document root or Node application. Any required DNS work is an owner/host step; none has been performed by this implementation.
2. Create a **new** Setup Node.js App: Node **22**, Production, application root **`badmintonxp-v1-test`**, Application URL the test hostname at `/`, startup **`app.js`**.
3. Extract the supplied v1 Node 22 ZIP in a temporary folder in your cPanel home. Its top folder is `badmintonxp-node` because the packaging tooling preserves the tested runtime layout. Move its **contents** into `/home/YOUR-ACCOUNT/badmintonxp-v1-test`. Do not overwrite the existing live `badmintonxp-node` directory.
4. The app root must contain `app.js`, `runtime/server.js`, `runtime/.next/BUILD_ID`, `runtime/.next/server`, `runtime/.next/static`, `runtime/public`, `package.json`, `package-lock.json` and `.npmrc`. Show hidden files in File Manager. Keep the build and static files together; replace the full runtime as one unit on later updates.
5. Run **NPM Install** in the new Node app. Preserve its managed `node_modules` symlink. Never upload a Mac `node_modules` folder.
6. Add only the three runtime settings from the table above in this test app's environment-variable section. Save and restart. No Supabase service key or database password belongs here.
7. In **Domains**, note the test hostname's actual Document Root. Its `.htaccess` must have cPanel's generated Passenger mapping for this **new app root**. If cPanel leaves it empty, adapt this block using the exact Node path shown in this test app's activation command:

   ```apache
   PassengerAppRoot "/home/YOUR-ACCOUNT/badmintonxp-v1-test"
   PassengerBaseURI "/"
   PassengerNodejs "/home/YOUR-ACCOUNT/nodevenv/badmintonxp-v1-test/22/bin/node"
   PassengerAppType node
   PassengerStartupFile app.js
   PassengerAppEnv production
   ```

   Derive `PassengerNodejs` by replacing `/bin/activate` with `/bin/node` in the actual activation-script path. Do not copy a guessed version path or change the live domain's working `.htaccess`.
8. Visit `https://YOUR-TEST-HOST/play`. The root still redirects to `/demo` intentionally. Verify sign-up/confirmation, profile save, quiz score after reload and another device/login, prediction lock, manual result settlement, and anonymous rankings. Check browser Network for all JS/CSS returning 200 and Console for errors. Test `/demo` separately: its scores must remain fictional and local.

A Vercel test project is an alternative: import this feature branch into a **new** project, set the three runtime settings, and add its generated URL to Supabase Auth redirects. Deploy only after the owner chooses to push/deploy the branch. Neither a deployment nor a GitHub push has been performed as part of this v1 build.

## Reproduce checks locally without any cloud project

Use Node 22 and Docker Desktop. The committed local Supabase configuration has project ID `badmintonxp-v1-local` and ports 54321–54324. It is deliberately unlinked from all cloud projects. Do not link it to production.

1. `npm ci`
2. `npx supabase start` (downloads local Docker images). Do not share its configuration output; use local Studio/email UI on your own machine.
3. `npm test` — existing guest/security unit tests plus embedded PostgreSQL migration, scoring and RLS tests.
4. `npm run typecheck` and `npm run lint`.
5. `npx supabase db lint --level warning` — local function/schema lint.
6. `npm run test:v1:integration` — real local Supabase Auth/Data API, RLS and concurrency tests.
7. `npm run build:cpanel` — secret-free production build; refuses local dotenv files and strips provider variables from the build process.
8. `npm run start:v1:local` — serves the standalone app on 127.0.0.1:3100, passing only local publishable configuration in child-process memory.
9. In another terminal, `npm run test:e2e` (guest regression suite), then `npm run test:v1:browser` (real local Auth/account, quiz, predictions, public rankings and admin checks at 360px/1440px). Run these sequentially; v1 fixture setup changes the local active test tournament.
10. Stop the local app. To discard the isolated stack, `npx supabase stop --no-backup` from this checkout. It affects only this local project. Browser-test fixture passwords are random, ephemeral, local-only and never stored in repo files.

To build another cPanel ZIP, run `npm run build:cpanel` followed by `npm run package:v1`; package the generated `../cpanel-upload/badmintonxp-node` folder. Do not build while dotenv files or keys are present. Configure runtime settings only on the separate test host.

## Current limits

Real tournament details await owner confirmation. Google OAuth, live feeds, referral rewards, moderation, email deliverability at the host, and correction/reversal of published questions or match results are outside this v1. The test copy needs owner-supplied project settings and a separate hostname before external players can use it. The existing static ChatGPT guest preview cannot host this server/database app and is unchanged.

## Reference documentation

- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Database function security](https://supabase.com/docs/guides/database/functions)
- [Email/password Auth](https://supabase.com/docs/guides/auth/passwords)
- [Local development](https://supabase.com/docs/guides/local-development)

## Dependency audit limitation

The Supabase client used by v1 was updated within its existing 2.x range to 2.119.0; it is no longer flagged by the audit. The full inherited repository still reports **52 production dependency findings (1 low, 26 moderate, 21 high, 4 critical)** at this check, including legacy AI/build dependencies and a Next-related transitive finding. Functional test passes are not a clean security-audit result. Do not treat this test copy as a production-release approval; dependency cleanup is separate work. No blanket force-upgrades or check suppressions were applied.
