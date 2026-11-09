# Authentication remediation on this branch

The login-page admin shortcut, embedded credentials, automatic admin signup and automatic role promotion were removed. Administrators now use the same email/password form as other users; existing authorized profile roles still control navigation. Public signup always submits player metadata and no longer exposes an admin flag. The legacy seed utility now generates a unique random password per account instead of sharing a literal password.

The auth provider uses real configuration guards, the current credentials shape, a properly cleaned-up subscription and deferred profile fetching outside the auth callback. No credentials were entered, printed or changed in any provider. No live account, database or policy operations were performed.

## Owner actions

- Change the password of the legacy administrator account whose credentials were embedded in the old login source. Revoke its existing sessions. Do not reuse that password anywhere else.
- If the old seed-users utility was ever run, disable/delete those test accounts or reset their passwords and revoke their sessions; they shared a hard-coded password. New seeds use per-account random passwords, but production seeding remains an explicitly operated legacy admin tool.
- Change any other account password that reused either of those exposed passwords.

Removing source values does not remove old Git history or archives. Rotation is still required. No private service key was found in the inspected login/context/seeding code, and no unrelated key rotation is being asserted as necessary.

Client-side role filtering is not authorization. Database row/column policies, auth metadata-to-profile triggers, storage policies and existing user roles still need a separate server-side review. They were neither accessed nor modified here. Legacy profile XP writes and account administration remain outside the isolated guest demo and are not certified production-safe by passing these checks.

## Owner-only rotation helper

`ADMIN_PASSWORD_STEPS.md` describes the interactive `scripts/rotate-admin-password.mjs` helper. Run it yourself in a private Terminal. The assistant has not executed it against Supabase; automated coverage uses mocked clients. The helper does not echo or save the service key or password and requires explicit typed confirmation before network/account actions.
