# Rotate the legacy admin password yourself

No password or service key is present in this file or helper. The helper has not been run against Supabase. Its tests use mocks only.

1. Open your Supabase project dashboard. From Connect, copy the **Project URL**. From API Keys, obtain a **server secret/service-role key**, not an anon/public key. Do not paste either secret or the new password into this chat.
2. Open your own private macOS Terminal in this checkout and run:

   ```sh
   node scripts/rotate-admin-password.mjs
   ```

3. Enter the Project URL. Paste the service key at the hidden prompt. Enter your new password twice at the hidden prompts. Neither input is echoed, passed as a shell argument, written to files, placed in environment variables, or persisted by the SDK. Avoid screen sharing or terminal session recording while doing this.
4. Check the fixed target displayed by the helper: **admin@badmintonxp.com**. Type **ROTATE** only when you want it to change that account's password and revoke all its sessions.
5. Wait for **Password changed. Global sign-out completed.** Existing short-lived access tokens may work until normal expiry; refresh sessions are revoked. Share only the success/failure message here, never any input values.

The helper refuses missing/unconfirmed/banned accounts before a write. It does not create users, promote roles, seed accounts, or change policies. It reports partial success explicitly if the password change succeeds but session revocation fails. Stop and review that message rather than blindly repeating. It accepts only HTTPS Supabase project domains, uses no browser and does not load `.env` files. Secrets exist temporarily in the running process's memory and in the encrypted request to your Supabase project; they are never embedded in source or intentionally logged. After success the process exits.

Run this after installing project dependencies (`npm ci --ignore-scripts --no-audit --no-fund`) if this is a fresh checkout. The helper uses the installed Supabase SDK from this repository regardless of the current working directory.
