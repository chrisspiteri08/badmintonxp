# BadmintonXP v1 — badmintonxp.com upload and Supabase setup

This package is for the existing Node 22 app at **https://badmintonxp.com**. The homepage redirects to `/play`; `/demo` remains the fictional guest game. **www redirects to the HTTPS apex domain**, preserving the path/query, so sign-in and email recovery use one origin.

Use a **NEW Supabase project for v1**, never the old legacy project. If both v1 migrations are already applied, this visitor-fix update needs **no SQL rerun**. The developer has not deployed this package, changed DNS, or connected to either cloud database. The feature branch is pushed without merging to main.

## 1. Create and configure the NEW Supabase project

1. Create a new project named **BadmintonXP-v1**, in an Asia region near the audience (Singapore is a reasonable choice). Keep the database password privately. Do not paste keys, passwords or connection strings into chat.
2. In the **new project's SQL Editor**, run the combined `BADMINTONXP_V1_SCHEMA.sql` included in this ZIP **once on the empty project**. It contains migrations `202611090001_v1.sql` and `202611090002_world_tour_finals_hold.sql`, in that order. Alternatively apply those two repo migrations in order with the CLI linked only to this NEW project. If migration 001 was already applied to a separately created v1 project, apply only 002 there. Never apply these to the legacy project.
3. Under **Authentication → Sign In / Providers → Email**, enable email/password signup and **Confirm email**. Set minimum password length to **6**. Leave anonymous sign-ins off. Configure Auth rate limits for your intended audience.
4. Under **Authentication → URL Configuration**, set **Site URL** to:

   ```text
   https://badmintonxp.com
   ```

   Add these four exact **Redirect URLs**:

   ```text
   https://badmintonxp.com/play/account
   https://www.badmintonxp.com/play/account
   https://badmintonxp.com/play/reset
   https://www.badmintonxp.com/play/reset
   ```

   No wildcard is needed. Site URL is the fallback; the app explicitly requests `/play/account` for confirmation and `/play/reset` for recovery. Requests originating on www use apex email links. www callback requests redirect to apex with the `code` query parameter intact.
5. Configure **custom SMTP** with a sender you control. Enter SMTP credentials only in Supabase's settings, never source files or chat. Verify confirmation and recovery mail delivery before inviting players; the built-in sender has recipient/rate restrictions.
6. Under **Authentication → Email Templates**, keep the verification link using `{{ .ConfirmationURL }}`. For example:

   Signup confirmation:

   ```html
   <a href="{{ .ConfirmationURL }}">Confirm your BadmintonXP account</a>
   ```

   Password recovery:

   ```html
   <a href="{{ .ConfirmationURL }}">Reset your BadmintonXP password</a>
   ```

   Do not replace these with a plain Site URL link: that would discard the Auth verification step. Open the email link in the same browser that requested it; this flow uses PKCE. Avoid email-provider link rewriting/tracking if it breaks verification links.
7. Leave the Data API enabled for **public** only. Never expose **private**, disable RLS, or grant players direct score/ledger writes. No Storage bucket, service key, Google OAuth, live feed or Edge Function is needed. Google sign-in remains deferred.

## 2. Runtime variables — enter them yourself in cPanel

In **Setup Node.js App → badmintonxp-node → Environment variables**, enter:

| Name | Value |
| --- | --- |
| `V1_NEW_PROJECT_CONFIRMED` | `true`, after checking you selected the NEW v1 project |
| `V1_SUPABASE_URL` | Project URL from the NEW project's settings |
| `V1_SUPABASE_PUBLISHABLE_KEY` | Publishable key from the NEW project; a legacy anon key from that NEW project is also accepted |

The old `V1_ISOLATED_TEST_PROJECT` switch is no longer used. Do not add a service-role/secret key, database password or legacy `NEXT_PUBLIC_SUPABASE_*` values. The app does not fall back to legacy configuration. No key values are included in the ZIP. Save and restart only after the files below have been installed.

The explicit new-project flag is an owner confirmation, not automatic proof of project identity: check the project name/reference in Supabase before copying its public settings. You do not need to send those values to the developer.

## 3. Cookies, www and HTTPS

- This version uses `supabase-js` browser **localStorage** (storage key `badmintonxp-v1-auth`), not server-side Auth cookies. There is **no cookie Domain setting** or shared `.badmintonxp.com` Auth cookie to configure. Do not add `COOKIE_DOMAIN` or custom cookie middleware.
- localStorage/PKCE state is origin-specific. Canonicalizing www to apex before the account screens load avoids two separate sessions and mismatched recovery verifiers. The www host remains usable by redirecting to apex; it is not a second independent app.
- In **cPanel → Domains**, ensure www is an alias of badmintonxp.com pointing to the same site/app. Do not create a competing Node application for www. In **SSL/TLS Status**, confirm the certificate covers **both** names. Enable the domain's **Force HTTPS Redirect** if not already enabled. If www is not attached to the same virtual host, ask NEOSERV to attach the alias; the developer has not changed DNS.
- Keep the working Passenger routing in `/home/shuttles/badmintonxp.com/.htaccess`. No cookie/domain rewrite or port-3000 proxy is needed. Domain routing must reach the existing `badmintonxp-node` app for both names before the application's canonical redirect can run.
- The app redirects www temporarily (307) rather than storing an irreversible browser redirect, helping rollback. Supabase auth callbacks retain their query parameters through this redirect.

## 4. Upload with rollback preserved

Use the latest supplied **BadmintonXP v1 Node 22 ZIP**, not a previous package. For the visitor-error fix release, the file is **BadmintonXP-v1-visitor-fixes-Node22.zip**. Keep any existing `runtime-demo-backup` intact: for an update after v1 is already installed, name the current runtime backup `runtime-v1-backup-20261110` (or another unused dated name), and use that chosen backup for rollback.

1. Open **cPanel → Setup Node.js App → badmintonxp-node**. Confirm Node **22.23.4** (or supported newer Node 22), **Production**, Application root **badmintonxp-node**, URL **badmintonxp.com/**, startup **app.js**. Click **Stop**.
2. Open **File Manager → Settings → Show Hidden Files**. Go to `/home/shuttles/badmintonxp-node`.
3. **Before extracting anything, rename `runtime` to `runtime-demo-backup` for the first guest-to-v1 upload.** For later updates, leave that original backup intact and rename the current runtime to `runtime-v1-backup-20261110` (or another unused dated name). Record your chosen backup name and never merge new files into it.
4. Create a sibling folder named `deployment-demo-backup` in the app root. **Copy** the current `app.js`, `package.json`, `package-lock.json`, `.npmrc`, and `PACKAGE-INFO.json` into it when present. Also keep a private copy of the working domain-root `.htaccess`. Record any prior app environment settings privately; do not export key values into the upload package or chat. Keep all backups outside the domain's document root.
5. Upload the ZIP to `/home/shuttles` and extract **there**. It already contains the top-level `badmintonxp-node` folder; this creates a fresh `/home/shuttles/badmintonxp-node/runtime` alongside `runtime-demo-backup`. Allow replacement of app/package metadata when prompted. Do **not** extract into the app root and create `badmintonxp-node/badmintonxp-node`.
6. Check these paths before starting:

   ```text
   /home/shuttles/badmintonxp-node/app.js
   /home/shuttles/badmintonxp-node/runtime/server.js
   /home/shuttles/badmintonxp-node/runtime/.next/BUILD_ID
   /home/shuttles/badmintonxp-node/runtime/.next/server
   /home/shuttles/badmintonxp-node/runtime/.next/static
   /home/shuttles/badmintonxp-node/runtime/public
   /home/shuttles/badmintonxp-node/runtime-demo-backup
   ```

   `.next` is hidden and belongs under `runtime`. HTML, manifests, JS and CSS must all come from this one package. Preserve cPanel's `node_modules` symlink; the ZIP contains no node_modules folder.
7. Back in **Setup Node.js App**, click **Run NPM Install**. This is required because the dependency versions/override changed from the older guest package. The generated runtime manifest preserves patched PostCSS. Do not upload Mac native modules or run a build on shared hosting.
8. Enter only the three NEW-project settings above. Click **Save**, **Start**, then **Restart**. If restarting seems ineffective, edit/save `/home/shuttles/badmintonxp-node/tmp/restart.txt` to request a fresh process.
9. Open a private browser window. Verify:
   - `https://badmintonxp.com/` redirects to `/play`.
   - `https://www.badmintonxp.com/` ends at `https://badmintonxp.com/play`.
   - `https://www.badmintonxp.com/demo` ends at the apex `/demo` and the guest game works.
   - `/play/account` sends confirmation mail; the email returns to the apex account screen.
   - Password recovery returns to `https://badmintonxp.com/play/reset`, saves the new password and signs out sessions.
   - All JS/CSS requests return 200; Console has no errors. If old hashed filenames appear, restart the Node app and clear/purge enabled page caches before uploading anything again.
   - No tournament is public until explicitly published. World Tour Finals 2026 must remain a draft.
   - `/login` and `/signup` redirect to `/play/account`; `/leaderboards` redirects to `/play/standings`.
   - `/api/health` returns only `{"databaseConnected":true}` (HTTP 200) or `{"databaseConnected":false}` (HTTP 503). It is a no-cache, three-second-timeout read of the public seasons table, not an admin/secret-key check. Empty tables are healthy. No URLs, keys, counts, SQL errors or server/configuration details are returned. If false, check the three cPanel settings and the NEW project's status privately, then restart. Visitors see only a friendly fallback message.

### Roll back if any upload check fails

1. Stop the Node app.
2. Rename the new `runtime` to `runtime-v1-failed` (or another unused name).
3. Rename **your chosen backup** (`runtime-demo-backup` or the dated v1 backup from this update) **back to `runtime`**.
4. Copy the backed-up `app.js`, `package.json`, `package-lock.json`, `.npmrc` and package metadata back from `deployment-demo-backup`. Restore the previous environment settings, removing the new V1 variables if they were absent before.
5. Run **NPM Install** again to restore the old package-lock versions. Preserve the managed node_modules symlink.
6. Start/restart and check `/demo` and the homepage. The old runtime includes its old redirect behavior. Restore `.htaccess` only if you changed it; this upload does not require altering the working Passenger block.

Rollback restores the guest application; it does not delete or alter the NEW Supabase project. Keep its data until the owner decides what to do. Never point the old guest runtime at the legacy or new project's service key.

## 5. Admin account and World Tour Finals 2026 — leave unpublished

1. Sign up at `https://badmintonxp.com/play/account`, confirm the email in the same browser, and save your profile.
2. In the **NEW project's SQL Editor**, substitute your confirmed admin email and run:

   ```sql
   insert into private.admins(user_id)
   select id from auth.users
   where lower(email) = lower('YOUR-CONFIRMED-ADMIN-EMAIL')
     and email_confirmed_at is not null
   on conflict do nothing;
   ```

   No passwords or service key are involved. Verify membership in SQL Editor, refresh `/play/profile`, then open **Tournament admin**.
3. Create the 2026 season, teams and a draft tournament named **World Tour Finals 2026**, using confirmed dates/times. No real fixture list or dates have been invented or pre-seeded by this package. Add matches and quiz questions only after verifying them. Date inputs use your device timezone and are stored in UTC.
4. **Do not publish the tournament.** Migration 002 installs a database trigger that blocks publishing/activating World Tour Finals 2026, even through a direct admin RPC. The admin publish button also shows **Publication on hold**. Drafts are not visible to players or anonymous rankings.
5. Do not remove or bypass the hold during setup. Releasing it requires a separate owner-approved change after the owner explicitly says to publish. Question/fixture publication and results are otherwise final in v1; review carefully before a future release.

## 6. Reproduce the checks locally

Use Node 22 and Docker Desktop. The repo-local Supabase project is `badmintonxp-v1-local`, deliberately unlinked from cloud projects. No main-domain request is sent by the browser tests; www checks use local requests with a Host header and do not follow the external redirect.

```sh
npm ci
npm audit --omit=dev
npm audit
npx supabase start
npm test
npm run typecheck
npm run lint
npx supabase db lint --level warning
npm run test:v1:integration
npm run build:cpanel
npm run start:v1:local
```

In another terminal, sequentially run `npm run test:e2e`, then `npm run test:v1:browser`. The local launcher passes only local configuration in process memory. Test credentials are random, ephemeral and never committed. Stop the app and run `npx supabase stop --no-backup` afterward.

Rebuild an upload folder with `npm run build:cpanel` then `npm run package:v1`; it is generated at `../cpanel-upload/badmintonxp-node`. Build refuses dotenv files and strips provider configuration. Never put keys into a build, source file or archive.

## References and limits

- [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Auth email template variables](https://supabase.com/docs/guides/auth/auth-email-templates)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js redirects](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)

See `DEPENDENCY_AUDIT.md` for the zero-finding dependency remediation. Tests run against local Supabase; real SMTP delivery, the NEW cloud project's configuration, www TLS/alias routing and the actual cPanel upload must be verified by the owner after upload. Google sign-in, live result feeds, prizes and payments remain absent. The static ChatGPT guest preview is unchanged.
