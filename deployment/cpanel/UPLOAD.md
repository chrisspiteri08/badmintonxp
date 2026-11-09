# BadmintonXP: cPanel upload

Use Node **22 LTS**, the newest 22.x version in the selector. Next.js is 15.5.29. This is a prebuilt standalone application: do not build Next.js on shared hosting.

1. Back up the existing website and its .htaccess before attaching an application to the domain root. Do not overwrite or delete the old site's files.
2. In cPanel → Software → Setup Node.js App → Create Application, select Node 22 and Production. Set Application root to **badmintonxp-node** (in your account home, outside public_html); Application URL to **badmintonxp.com /** (the domain root, not /demo); startup file to **app.js**. If a Node app already owns this URL, update that app instead of registering a competing mapping.
3. Upload the provided ZIP into your account home and extract it there. The final path must be **/home/YOUR_CPANEL_USERNAME/badmintonxp-node/app.js**, not a duplicated badmintonxp-node/badmintonxp-node folder. Include hidden files/folders, especially runtime/.next and .npmrc. Replace the generated “It works” app.js with this package's app.js. Preserve cPanel's node_modules symlink, if already present.
4. Select **Run NPM Install** in Setup Node.js App. Alternatively, open Terminal, run the exact virtual-environment activation command displayed by cPanel for this application, then run `npm install --omit=dev --no-audit --no-fund` in the application root. Do not upload your Mac's node_modules. The package contains only four runtime dependencies with a lockfile; Linux-native optional dependencies are installed by the host. Do not use `npm ci` if it would replace cPanel's managed node_modules symlink.
5. Production mode supplies NODE_ENV=production. No Supabase URL, anon key, service key, .env file or other secret is needed. Leave PORT to the hosting platform; app.js supplies the safe bind address. Do not start a second manual server, use PM2, or run npm run build on cPanel.
6. Click **Restart**. Visit **https://badmintonxp.com/**: it should redirect temporarily (HTTP 307) to **/demo**. Also test direct /demo/quiz, /demo/prediction, /demo/standings and /demo/progress, and verify artwork/styles load.

## Package contents

- app.js — cPanel startup entry.
- runtime/server.js — generated Next standalone server.
- runtime/.next — compiled server and static chunks.
- runtime/public — approved artwork.
- package.json / package-lock.json / .npmrc — small runtime install for the host OS.
- tmp/ — restart marker directory; no state or credentials.

The old repository root server.js is a historical Hello World server: do not upload or select it. Upload only this package folder, not the Git checkout, source ZIPs, archives, password helper or local build caches. Existing legacy routes remain unconfigured without backend keys; the supported guest entry is /demo. Guest scores remain local to each visitor's browser.

## If it does not load

- 503: inspect this application's stderr.log in File Manager. Confirm Node 22, dependencies installed in the correct activated environment, app.js selected, and runtime/server.js present. Check hosting memory/process limits.
- Missing CSS/art: ensure runtime/.next/static and runtime/public were extracted; enable hidden-file visibility in File Manager.
- Root still shows an old PHP/WordPress site: ask support to check this domain's Passenger/LiteSpeed mapping and conflicting .htaccess rules. Do not blindly delete or replace .htaccess.
- Domain cannot resolve or HTTPS fails before reaching the app: application files cannot repair DNS/SSL. The earlier public DNS check returned SERVFAIL; resolve that separately with the DNS/hosting providers if it persists. No DNS changes were made while preparing this package.

This package is tested locally on Node 22, not inside your actual cPanel/Passenger account. The hosting provider controls final request routing, process limits and TLS.

Sources: https://www.neoserv.com/blog/nodejs-application-on-web-hosting and https://nextjs.org/docs/app/api-reference/config/next-config-js/output
