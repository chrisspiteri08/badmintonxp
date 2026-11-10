# BadmintonXP tournament administration

Open **https://badmintonxp.com/play/admin** after signing in. Use an ordinary confirmed website account for your assistant; never give them your Supabase dashboard login, database password or service key.

## Roles and handover

| Action | Owner admin | Content editor | Player |
| --- | --- | --- | --- |
| Create seasons/teams, draft tournaments/matches/quizzes/questions | Yes | Yes | No |
| Review keys, correct/remove unpublished questions, publish eligible content | Yes | Yes | No |
| Enter final match results and trigger automatic settlement | Yes | Yes | No |
| Read registered-player list/email addresses | Yes | No | No |
| Change other users or assign roles through the website | No | No | No |
| Insert/update/delete XP by hand | No | No | No |
| Manage their own ordinary player profile | Yes | Yes | Yes |

Owner role assignment is a trusted SQL Editor operation, not an assistant permission. Content-editor membership is separate from owner-admin membership; it does not unlock private player profiles, attempts, predictions or ledger entries. Content editors see only their own ordinary player records through normal RLS. Result settlement may award XP automatically; it never accepts a manual XP amount. Never invite the assistant as a Supabase organization/project administrator for this task.

### Assign a content editor

1. Ask the assistant to sign up through `/play/account` and confirm their email.
2. In the **NEW v1 project's SQL Editor**, apply migration `202611100001_content_editors.sql` once if not already applied. Existing installations apply this migration only; do not rerun the initial schema.
3. Substitute the confirmed signup email and run:

   ```sql
   insert into private.content_editors(user_id)
   select id from auth.users
   where lower(email)=lower('ASSISTANT_SIGNUP_EMAIL')
     and email_confirmed_at is not null
   on conflict do nothing;
   ```

4. Check:

   ```sql
   select u.email,
          u.email_confirmed_at is not null as email_confirmed,
          a.user_id is not null as owner_admin,
          e.user_id is not null as content_editor
   from auth.users u
   left join private.admins a on a.user_id=u.id
   left join private.content_editors e on e.user_id=u.id
   where lower(u.email)=lower('ASSISTANT_SIGNUP_EMAIL');
   ```

   For an editor-only assistant, expect confirmed=true, content_editor=true, owner_admin=false. No row means the account is in a different project or has not signed up. If this account was previously made an owner admin, the owner must deliberately remove that existing `private.admins` membership; adding editor membership does not downgrade an owner.
5. Have them refresh `/play/profile` and open **Tournament admin**. The desk shows **Content editor** and no player list.

To revoke editor access, the owner runs:

```sql
delete from private.content_editors
where user_id in (
  select id from auth.users where lower(email)=lower('ASSISTANT_SIGNUP_EMAIL')
);
```

Role checks are database-side on each request; refresh the page afterward. Do not use editable signup metadata to assign roles.

## Daily process

All date inputs use the device/browser timezone. Review displayed local times carefully; the database stores UTC and enforces deadlines using server time.

### 1. Season and teams

Create the season once (for example `2026`). If it already exists, select it instead of creating a duplicate. Create the teams fans may join. These are shared setup entries, not draft tournaments. Players choose their own team/country before first play; affiliation locks after their first attempt or prediction.

### 2. Draft tournament

Create a tournament linked to that season, with confirmed name/start/end times. The end must follow the start. Saving does **not** publish it. A season must exist first; the desk explains missing setup and disables actions that have no valid parent.

### 3. Matches

Select the draft tournament. Add each actual athlete/pair and the prediction closing time. The athletes must differ. Close predictions before the match starts. Stage the fixture list before publishing: in this version you cannot add matches or quizzes to a published tournament, or edit published fixtures. Do not publish a placeholder fixture list expecting to correct it later. Ask the owner about a published-content correction rather than changing the database yourself.

### 4. Quizzes and questions

Create the quiz under the draft tournament, with its opening and entry-closing times. Entries close must follow opens. This is the window for starting the quiz; an already-started attempt can finish afterward.

Write questions numbered **1, 2, 3…**, with no gaps or duplicate numbers, up to 50. Each question needs four nonempty options, exactly one selected correct answer and an explanation. Correct answers are never sent to ordinary players before they lock their answer.

Use **Edit question** to correct an unpublished question or its number. Use **Remove question** with its in-page confirmation to remove a draft mistake, then repair numbering. Published questions cannot be edited or removed. Editing a draft does not change scores: no player can attempt an unpublished quiz.

### 5. Review and publish the quiz

The quiz readiness panel explains missing questions, gaps or invalid answer data. Its publish button stays disabled until ready. Publishing freezes the questions; it does **not** by itself make a draft tournament playable. The success message says that the tournament must also be published and the quiz opening time reached.

### 6. Review and publish the tournament

The tournament readiness panel lists all blockers:

- Add at least one match.
- Publish at least one quiz linked to this tournament.
- Resolve any owner publication hold.

When allowed, publishing makes this the **single current event**. The previously current event becomes inactive, but remains published and its ledger/season history is retained. Publishing does not override quiz opening times or prediction deadlines. Confirm the tournament, fixture list, times and quiz keys before publishing.

**World Tour Finals 2026 remains intentionally blocked.** Migration 002 enforces an owner-requested database trigger. The desk labels it “Publication on hold” and explains it; even a direct owner/editor publish RPC is rejected. This is not a bug and this update does not remove it. The owner must explicitly authorize a separate release change. No real dates, questions or fixtures are invented by the software.

### 7. Match results and settlement

In **Enter match results**, find the correct match/tournament. Before its closing time, the desk shows when results unlock and disables winner buttons. After the server-side deadline, verify the real result, choose the winner, and confirm in-page. Do not use this screen to simulate a result on the real site.

A correct prediction earns **20 XP**; a wrong/no pick earns no award. Each player has one immutable prediction per match. Settlement and ledger insertion are one transaction. Repeating the same result is harmless and cannot award twice; changing an already-final winner is rejected. There is no correction/reversal UI in this version—contact the owner if the wrong result was entered. Never patch the XP ledger by hand.

Quiz awards are automatic on completion: **10 XP per correct answer**, 0 for a wrong answer/timeout, 15 server-timed seconds per question, first accepted tap final. Do not settle quizzes manually. Individual/team/country event and season leaderboards all aggregate the same immutable ledger.

## Common messages and recovery

| Message/blocker | What to do |
| --- | --- |
| Create a season first | Save/select the season before making a tournament |
| Create a draft tournament/quiz first | Create the missing parent; published parents are locked |
| Add at least one question | Save the first question before publishing the quiz |
| Number questions consecutively from 1 | Edit/remove the misplaced draft number, then review again |
| Name or question number already used | Select/edit the existing item or use an unused number/name |
| Check the fields | Check date order, distinct athletes and allowed question numbers |
| Publish at least one quiz | Publish the quiz, then return to tournament review |
| Publication on hold | Wait for explicit owner approval; do not bypass it |
| Results unlock after… / Wait until predictions close | Wait; do not change the server clock or closing time to force settlement |
| Result already final | Do not enter a conflicting winner; ask the owner |
| Tournament desk access required | Check confirmed signup and editor membership in the NEW project |
| Friendly temporary outage | Retry later; ask the owner to check `/api/health` and cPanel settings privately |

The desk does not expose SQL errors, API keys or server diagnostics. Business messages explain the action needed without configuration details.

## Deploying this update

For an existing v1 project, run **only** `supabase/migrations/202611100001_content_editors.sql` once in that project's SQL Editor. Then upload the new Node 22 ZIP using the rollback process in `V1_SETUP.md` and restart. Existing settings, six-character password minimum, `/demo`, health endpoint and the World Tour Finals hold are preserved. A fresh project instead applies all migrations in filename order (or the combined initial schema). No service key is needed by the app or assistant. Cloud SQL and upload are owner actions; they were not performed by the developer.
