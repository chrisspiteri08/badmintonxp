-- Apply only to a NEW, isolated Supabase project. Never to the legacy production DB.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.admins enable row level security;

create table public.teams (
 id uuid primary key default gen_random_uuid(), name text not null unique check (length(name) between 2 and 40)
);
create table public.seasons (
 id uuid primary key default gen_random_uuid(), name text not null unique check (length(name) between 2 and 80)
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
 country text not null default 'MY' check (country ~ '^[A-Z]{2}$'),
 team_id uuid references public.teams(id), created_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles(lower(username));
create table public.tournaments (
 id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons(id),
 name text not null check (length(name) between 2 and 100), starts_at timestamptz not null,
 ends_at timestamptz not null, published boolean not null default false,
 active boolean not null default false, check (ends_at > starts_at), check (not active or published)
);
create unique index one_active_tournament on public.tournaments(active) where active;
create table public.matches (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id),
 athlete_a text not null check (length(athlete_a) between 2 and 80),
 athlete_b text not null check (length(athlete_b) between 2 and 80),
 closes_at timestamptz not null, winner text, settled_at timestamptz,
 check (athlete_a <> athlete_b), check (winner is null or winner in (athlete_a, athlete_b)),
 check ((winner is null) = (settled_at is null))
);
create table public.quizzes (
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id),
 title text not null check (length(title) between 2 and 100), published boolean not null default false,
 opens_at timestamptz not null, closes_at timestamptz not null, check (closes_at > opens_at)
);
create table public.questions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id),
 position integer not null check (position between 0 and 49),
 prompt text not null check (length(prompt) between 5 and 500), options jsonb not null,
 check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
 unique(quiz_id, position)
);
create table private.question_answers (
 question_id uuid primary key references public.questions(id) on delete cascade,
 correct_option integer not null check (correct_option between 0 and 3),
 explanation text not null check (length(explanation) between 1 and 1000)
);
alter table private.question_answers enable row level security;
create table public.attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 quiz_id uuid not null references public.quizzes(id), team_id uuid references public.teams(id), country text not null,
 current_position integer not null default 0, deadline timestamptz not null,
 awaiting_next boolean not null default false, complete boolean not null default false,
 started_at timestamptz not null default now(), unique(user_id, quiz_id)
);
create table public.attempt_answers (
 attempt_id uuid not null references public.attempts(id), position integer not null,
 question_id uuid not null references public.questions(id), option integer check (option between 0 and 3),
 xp integer not null check (xp in (0,10)), answered_at timestamptz not null,
 primary key(attempt_id, position)
);
create table public.predictions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 match_id uuid not null references public.matches(id), pick text not null,
 team_id uuid references public.teams(id), country text not null, created_at timestamptz not null default now(),
 unique(user_id, match_id)
);
create table public.xp_ledger (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 tournament_id uuid not null references public.tournaments(id), season_id uuid not null references public.seasons(id),
 team_id uuid references public.teams(id), country text not null,
 source_type text not null check (source_type in ('quiz','prediction')), source_id uuid not null,
 xp integer not null check (xp >= 0 and xp <= 500), awarded_at timestamptz not null default now(),
 unique(user_id, source_type, source_id)
);
create index ledger_tournament on public.xp_ledger(tournament_id, user_id);
create index ledger_season on public.xp_ledger(season_id, user_id);
create index predictions_match on public.predictions(match_id);
create index answers_question on public.attempt_answers(question_id);

create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.admins where user_id = auth.uid());
$$;
-- Policies can call only this boolean helper, not access the private tables.
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
revoke all on function private.is_admin() from public, anon;
create function private.require_player() returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to play.'; end if;
 return auth.uid();
end $$;
create function private.require_admin() returns void language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Admin access required.'; end if;
end $$;
-- Do not trust signup metadata for roles, affiliation, or profile identity.
create or replace function private.new_player() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id, username) values(new.id, 'player_' || left(replace(new.id::text,'-',''),17));
 return new;
end $$;
create trigger v1_auth_user_created after insert on auth.users for each row execute function private.new_player();

-- No client (including admins) has direct INSERT/UPDATE/DELETE privileges. Mutations use guarded RPCs.
do $$
declare t text;
begin
 foreach t in array array['teams','seasons','profiles','tournaments','matches','quizzes','questions','attempts','attempt_answers','predictions','xp_ledger'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
grant select on public.teams, public.seasons, public.tournaments, public.matches, public.quizzes to anon;
create policy teams_read on public.teams for select to anon, authenticated using (true);
create policy seasons_read on public.seasons for select to anon, authenticated using (true);
create policy profiles_own on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_admin());
create policy tournaments_read on public.tournaments for select to anon, authenticated using (published or private.is_admin());
create policy matches_read on public.matches for select to anon, authenticated using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.published) or private.is_admin());
create policy quizzes_read on public.quizzes for select to anon, authenticated using ((published and exists(select 1 from public.tournaments t where t.id=tournament_id and t.published)) or private.is_admin());
create policy questions_admin on public.questions for select to authenticated using (private.is_admin());
create policy attempts_own on public.attempts for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy answers_own on public.attempt_answers for select to authenticated using (exists(select 1 from public.attempts a where a.id=attempt_id and a.user_id = (select auth.uid())) or private.is_admin());
create policy predictions_own on public.predictions for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy ledger_own on public.xp_ledger for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
-- Anonymous policies need this helper but it still only reveals a boolean about the caller.
grant usage on schema private to anon;
grant execute on function private.is_admin() to anon;

create function public.v1_profile(p_username text, p_country text, p_team_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_player(); p public.profiles;
begin
 select * into p from public.profiles where id=u for no key update;
 if (p.team_id is distinct from p_team_id or p.country <> p_country) and
 (exists(select 1 from public.attempts where user_id=u) or exists(select 1 from public.predictions where user_id=u)) then
  raise exception 'Your team and country are locked once you start playing.';
 end if;
 update public.profiles set username=trim(p_username), country=p_country, team_id=p_team_id where id=u returning * into p;
 return to_jsonb(p);
end $$;

create function private.finish_quiz(p_attempt uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 insert into public.xp_ledger(user_id,tournament_id,season_id,team_id,country,source_type,source_id,xp)
 select a.user_id,t.id,t.season_id,a.team_id,a.country,'quiz',a.quiz_id,coalesce(sum(aa.xp),0)
 from public.attempts a join public.quizzes q on q.id=a.quiz_id join public.tournaments t on t.id=q.tournament_id
 left join public.attempt_answers aa on aa.attempt_id=a.id where a.id=p_attempt and a.complete
 group by a.user_id,t.id,t.season_id,a.team_id,a.country,a.quiz_id
 on conflict(user_id,source_type,source_id) do nothing;
end $$;

create function private.quiz_payload(p_attempt uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.attempts; question jsonb; review jsonb; score integer;
begin
 select * into a from public.attempts where id=p_attempt;
 select coalesce(sum(xp),0) into score from public.attempt_answers where attempt_id=a.id;
 select coalesce(jsonb_agg(jsonb_build_object('position',aa.position,'option',aa.option,'xp',aa.xp,
  'prompt',q.prompt,'options',q.options,'correct_option',qa.correct_option,'explanation',qa.explanation) order by aa.position),'[]'::jsonb)
 into review from public.attempt_answers aa join public.questions q on q.id=aa.question_id
 join private.question_answers qa on qa.question_id=q.id where aa.attempt_id=a.id;
 if not a.complete and not a.awaiting_next then
  select jsonb_build_object('position',position,'prompt',prompt,'options',options) into question
  from public.questions where quiz_id=a.quiz_id and position=a.current_position;
 end if;
 return jsonb_build_object('id',a.id,'quiz_id',a.quiz_id,'complete',a.complete,'awaiting_next',a.awaiting_next,
 'deadline',a.deadline,'server_now',clock_timestamp(),'score',score,'question',question,'answers',review);
end $$;

create function private.expire_questions(p_attempt uuid) returns void language plpgsql security definer set search_path = '' as $$
declare a public.attempts; q public.questions; count_q integer; n timestamptz := clock_timestamp();
begin
 select * into a from public.attempts where id=p_attempt for update;
 select count(*) into count_q from public.questions where quiz_id=a.quiz_id;
 while not a.complete and not a.awaiting_next and n >= a.deadline loop
  select * into strict q from public.questions where quiz_id=a.quiz_id and position=a.current_position;
  insert into public.attempt_answers(attempt_id,position,question_id,option,xp,answered_at)
   values(a.id,a.current_position,q.id,null,0,a.deadline) on conflict do nothing;
  a.current_position := a.current_position+1;
  a.complete := a.current_position >= count_q;
  a.deadline := a.deadline+interval '15 seconds';
 end loop;
 update public.attempts set current_position=a.current_position, complete=a.complete, deadline=a.deadline where id=a.id;
 if a.complete then perform private.finish_quiz(a.id); end if;
end $$;

create function public.v1_quiz(p_quiz_id uuid, p_action text default 'resume', p_position integer default null, p_option integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_player(); a public.attempts; q public.questions; quiz public.quizzes;
 p public.profiles; total integer; correct integer; n timestamptz;
begin
 if p_action not in ('start','resume','answer','next') then raise exception 'Invalid quiz action.'; end if;
 -- One lock serializes concurrent starts, answers and affiliation changes for this player.
 select * into strict p from public.profiles where id=u for no key update;
 select * into quiz from public.quizzes where id=p_quiz_id for share;
 if not found or not quiz.published or not exists(select 1 from public.tournaments where id=quiz.tournament_id and published) then
  raise exception 'Quiz is not available.';
 end if;
 select * into a from public.attempts where user_id=u and quiz_id=p_quiz_id for update;
 if not found then
  if p_action <> 'start' then return null; end if;
  if clock_timestamp() < quiz.opens_at or clock_timestamp() >= quiz.closes_at then raise exception 'Quiz entries are closed.'; end if;
  insert into public.attempts(user_id,quiz_id,team_id,country,deadline)
   values(u,quiz.id,p.team_id,p.country,clock_timestamp()+interval '15 seconds') returning * into a;
 end if;
 perform private.expire_questions(a.id);
 select * into a from public.attempts where id=a.id;
 select count(*) into total from public.questions where quiz_id=quiz.id;
 if p_action='next' and a.awaiting_next and not a.complete then
  update public.attempts set awaiting_next=false, current_position=current_position+1, deadline=clock_timestamp()+interval '15 seconds' where id=a.id;
 elsif p_action='answer' and not a.complete and not a.awaiting_next and p_position=a.current_position then
  if p_option is null or p_option not between 0 and 3 then raise exception 'Choose one answer.'; end if;
  select * into strict q from public.questions where quiz_id=quiz.id and position=a.current_position;
  select correct_option into strict correct from private.question_answers where question_id=q.id;
  -- Check time immediately before the insert; never trust a browser timestamp or score.
  n := clock_timestamp();
  if n >= a.deadline then
   perform private.expire_questions(a.id);
  else
   insert into public.attempt_answers(attempt_id,position,question_id,option,xp,answered_at)
    values(a.id,a.current_position,q.id,p_option,case when p_option=correct then 10 else 0 end,n) on conflict do nothing;
   update public.attempts set complete=(current_position+1 >= total), awaiting_next=(current_position+1 < total) where id=a.id;
   if a.current_position+1 >= total then perform private.finish_quiz(a.id); end if;
  end if;
 end if;
 return private.quiz_payload(a.id);
end $$;

create function public.v1_predict(p_match_id uuid, p_pick text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_player(); m public.matches; p public.profiles; entry public.predictions;
begin
 select * into strict p from public.profiles where id=u for no key update;
 select * into m from public.matches where id=p_match_id for update;
 if not found or not exists(select 1 from public.tournaments where id=m.tournament_id and published) then raise exception 'Match is not available.'; end if;
 select * into entry from public.predictions where user_id=u and match_id=m.id;
 if found then return to_jsonb(entry); end if;
 if clock_timestamp() >= m.closes_at or m.winner is not null then raise exception 'Predictions are closed.'; end if;
 if p_pick not in (m.athlete_a,m.athlete_b) or p_pick is null then raise exception 'Choose an athlete.'; end if;
 insert into public.predictions(user_id,match_id,pick,team_id,country) values(u,m.id,p_pick,p.team_id,p.country) returning * into entry;
 return to_jsonb(entry);
end $$;

create function public.v1_settle_match(p_match_id uuid, p_winner text) returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches;
begin
 perform private.require_admin();
 select * into m from public.matches where id=p_match_id for update;
 if not found then raise exception 'Match not found.'; end if;
 if m.winner is not null then
  if m.winner=p_winner then return; end if;
  raise exception 'Result already final. It cannot be changed.';
 end if;
 if clock_timestamp() < m.closes_at then raise exception 'Wait until predictions close.'; end if;
 if p_winner is null or p_winner not in (m.athlete_a,m.athlete_b) then raise exception 'Invalid winner.'; end if;
 update public.matches set winner=p_winner,settled_at=clock_timestamp() where id=m.id;
 insert into public.xp_ledger(user_id,tournament_id,season_id,team_id,country,source_type,source_id,xp)
 select p.user_id,t.id,t.season_id,p.team_id,p.country,'prediction',m.id,case when p.pick=p_winner then 20 else 0 end
 from public.predictions p join public.tournaments t on t.id=m.tournament_id where p.match_id=m.id
 on conflict(user_id,source_type,source_id) do nothing;
end $$;

create function public.v1_leaderboard(p_tournament_id uuid, p_scope text default 'event', p_league text default 'players')
returns table(id text, name text, xp bigint, rank bigint) language plpgsql stable security definer set search_path = '' as $$
declare season uuid;
begin
 if p_scope not in ('event','season') or p_league not in ('players','teams','countries') then raise exception 'Invalid leaderboard.'; end if;
 select season_id into season from public.tournaments where tournaments.id=p_tournament_id and published;
 if not found then return; end if;
 return query with sums as (
  select case p_league when 'players' then l.user_id::text when 'teams' then l.team_id::text else l.country end as entity,
   case p_league when 'players' then p.username when 'teams' then tm.name else l.country end as label,sum(l.xp)::bigint as points
  from public.xp_ledger l join public.profiles p on p.id=l.user_id left join public.teams tm on tm.id=l.team_id
  where (p_scope='event' and l.tournament_id=p_tournament_id or p_scope='season' and l.season_id=season)
   and (p_league<>'teams' or l.team_id is not null)
  group by 1,2
 ) select entity,label,points,rank() over(order by points desc) from sums order by points desc,entity;
end $$;

create function public.v1_home() returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); t public.tournaments;
begin
 select * into t from public.tournaments where active and published;
 return jsonb_build_object('server_now',clock_timestamp(),'admin',private.is_admin(),
 'profile',(select to_jsonb(p) from public.profiles p where p.id=u),
 'teams',(select coalesce(jsonb_agg(tm order by tm.name),'[]'::jsonb) from public.teams tm),
 'tournament',case when t.id is null then null else to_jsonb(t) end,
 'quizzes',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'opens_at',q.opens_at,'closes_at',q.closes_at,
  'question_count',(select count(*) from public.questions where quiz_id=q.id),
  'attempt',(select jsonb_build_object('complete',a.complete,'score',(select coalesce(sum(xp),0) from public.attempt_answers where attempt_id=a.id)) from public.attempts a where a.quiz_id=q.id and a.user_id=u)) order by q.opens_at),'[]'::jsonb)
  from public.quizzes q where q.tournament_id=t.id and q.published),
 'matches',(select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('entry',(select to_jsonb(pr) from public.predictions pr where pr.match_id=m.id and pr.user_id=u)) order by m.closes_at),'[]'::jsonb) from public.matches m where m.tournament_id=t.id),
 'lifetime_xp',(select coalesce(sum(xp),0) from public.xp_ledger where user_id=u),
 'event_xp',(select coalesce(sum(xp),0) from public.xp_ledger where user_id=u and tournament_id=t.id));
end $$;

create function public.v1_admin_snapshot() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 perform private.require_admin();
 return jsonb_build_object('seasons',(select coalesce(jsonb_agg(s),'[]') from public.seasons s),
 'tournaments',(select coalesce(jsonb_agg(t order by t.starts_at),'[]') from public.tournaments t),
 'matches',(select coalesce(jsonb_agg(m order by m.closes_at),'[]') from public.matches m),
 'quizzes',(select coalesce(jsonb_agg(q),'[]') from public.quizzes q),
 'questions',(select coalesce(jsonb_agg(to_jsonb(q)||to_jsonb(a)),'[]') from public.questions q join private.question_answers a on a.question_id=q.id),
 'players',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('email',u.email)),'[]') from public.profiles p join auth.users u on u.id=p.id));
end $$;

create function public.v1_admin_save(p_kind text, p_data jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; parent uuid; q public.quizzes; t public.tournaments; count_q integer;
begin
 perform private.require_admin();
 if p_kind='season' then
  insert into public.seasons(name) values(p_data->>'name') returning id into result;
 elsif p_kind='team' then
  insert into public.teams(name) values(p_data->>'name') returning id into result;
 elsif p_kind='tournament' then
  insert into public.tournaments(season_id,name,starts_at,ends_at) values((p_data->>'season_id')::uuid,p_data->>'name',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz) returning id into result;
 elsif p_kind='match' then
  parent := (p_data->>'tournament_id')::uuid;
  select * into strict t from public.tournaments where id=parent for update;
  if t.published then raise exception 'Add matches before publishing the tournament.'; end if;
  insert into public.matches(tournament_id,athlete_a,athlete_b,closes_at) values(parent,p_data->>'athlete_a',p_data->>'athlete_b',(p_data->>'closes_at')::timestamptz) returning id into result;
 elsif p_kind='quiz' then
  parent := (p_data->>'tournament_id')::uuid;
  select * into strict t from public.tournaments where id=parent for update;
  if t.published then raise exception 'Add quizzes before publishing the tournament.'; end if;
  insert into public.quizzes(tournament_id,title,opens_at,closes_at) values(parent,p_data->>'title',(p_data->>'opens_at')::timestamptz,(p_data->>'closes_at')::timestamptz) returning id into result;
 elsif p_kind='question' then
  parent := (p_data->>'quiz_id')::uuid;
  select * into strict q from public.quizzes where id=parent for update;
  if q.published then raise exception 'Published questions cannot be changed.'; end if;
  if jsonb_typeof(p_data->'options') <> 'array' or jsonb_array_length(p_data->'options') <> 4 or
   exists(select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o)<>'string' or length(o#>>'{}') not between 1 and 200) then raise exception 'Provide four answer options.'; end if;
  insert into public.questions(quiz_id,position,prompt,options) values(parent,(p_data->>'position')::integer,p_data->>'prompt',p_data->'options') returning id into result;
  insert into private.question_answers(question_id,correct_option,explanation) values(result,(p_data->>'correct_option')::integer,p_data->>'explanation');
 elsif p_kind='publish_quiz' then
  result := (p_data->>'id')::uuid;
  select * into strict q from public.quizzes where id=result for update;
  select count(*) into count_q from public.questions where quiz_id=result;
  if count_q<1 or (select max(position) from public.questions where quiz_id=result)<>count_q-1 or
   exists(select 1 from public.questions qs left join private.question_answers a on a.question_id=qs.id where qs.quiz_id=result and a.question_id is null) then raise exception 'Quiz needs consecutive questions from position 0 and an answer key for each.'; end if;
  update public.quizzes set published=true where id=result;
 elsif p_kind='publish_tournament' then
  -- Take the global publication lock before any tournament row lock.
  perform pg_advisory_xact_lock(20261109);
  result := (p_data->>'id')::uuid;
  select * into strict t from public.tournaments where id=result for update;
  if not exists(select 1 from public.matches where tournament_id=result) or not exists(select 1 from public.quizzes where tournament_id=result and published) then raise exception 'Add a match and a published quiz first.'; end if;
  -- A single current event; previously published events remain available for season history.
  update public.tournaments set active=false where active;
  update public.tournaments set published=true,active=true where id=result;
 else raise exception 'Unknown admin action.';
 end if;
 return result;
end $$;

-- Explicit allowlist: private functions cannot be invoked over the Data API.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'v1_%' loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
  if f.proname in ('v1_home','v1_leaderboard') then execute format('grant execute on function %s to anon',f.signature); end if;
 end loop;
end $$;
