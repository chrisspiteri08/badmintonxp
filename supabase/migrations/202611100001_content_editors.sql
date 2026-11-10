-- Apply once to the NEW v1 project, after migrations 001 and 002.
create table private.content_editors (user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.content_editors enable row level security;
revoke all on private.content_editors from public, anon, authenticated;
create function private.can_manage_content() returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_admin() or exists(select 1 from private.content_editors where user_id=auth.uid());
$$;
create function private.require_content_editor() returns void language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.can_manage_content() then raise exception 'Tournament desk access required.'; end if;
end $$;
revoke all on function private.can_manage_content(), private.require_content_editor() from public, anon, authenticated;
grant execute on function private.can_manage_content() to anon, authenticated;
-- Expand only content-read policies. Private user/attempt/prediction/XP policies stay admin/owner-only.
alter policy tournaments_read on public.tournaments using (published or private.can_manage_content());
alter policy matches_read on public.matches using (exists(select 1 from public.tournaments t where t.id=tournament_id and t.published) or private.can_manage_content());
alter policy quizzes_read on public.quizzes using ((published and exists(select 1 from public.tournaments t where t.id=tournament_id and t.published)) or private.can_manage_content());
alter policy questions_admin on public.questions using (private.can_manage_content());

create or replace function public.v1_home() returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); t public.tournaments;
begin
 select * into t from public.tournaments where active and published;
 return jsonb_build_object('server_now',clock_timestamp(),'admin',private.is_admin(),'content_editor',private.can_manage_content(),
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

create or replace function public.v1_admin_snapshot() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 perform private.require_content_editor();
 return jsonb_build_object('server_now',statement_timestamp(),'role',case when private.is_admin() then 'admin' else 'content_editor' end,'seasons',(select coalesce(jsonb_agg(s),'[]') from public.seasons s),
 'tournaments',(select coalesce(jsonb_agg(t order by t.starts_at),'[]') from public.tournaments t),
 'matches',(select coalesce(jsonb_agg(m order by m.closes_at),'[]') from public.matches m),
 'quizzes',(select coalesce(jsonb_agg(q),'[]') from public.quizzes q),
 'questions',(select coalesce(jsonb_agg(to_jsonb(q)||to_jsonb(a)),'[]') from public.questions q join private.question_answers a on a.question_id=q.id),
 'players',case when private.is_admin() then (select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('email',u.email)),'[]') from public.profiles p join auth.users u on u.id=p.id) else '[]'::jsonb end);
end $$;

create or replace function public.v1_admin_save(p_kind text, p_data jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; parent uuid; q public.quizzes; t public.tournaments; count_q integer;
begin
 perform private.require_content_editor();
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
 elsif p_kind in ('question','delete_question') then
  parent := (p_data->>'quiz_id')::uuid;
  select * into strict q from public.quizzes where id=parent for update;
  if q.published then raise exception 'Published questions cannot be changed.'; end if;
  if p_kind='delete_question' then
   delete from public.questions where id=(p_data->>'id')::uuid and quiz_id=parent returning id into result;
   if result is null then raise exception 'Question not found in this draft quiz.'; end if;
   return result;
  end if;
  if jsonb_typeof(p_data->'options') <> 'array' or jsonb_array_length(p_data->'options') <> 4 or
   exists(select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o)<>'string' or length(o#>>'{}') not between 1 and 200) then raise exception 'Provide four answer options.'; end if;
  if p_data->>'id' is not null then
   update public.questions set position=(p_data->>'position')::integer,prompt=p_data->>'prompt',options=p_data->'options'
   where id=(p_data->>'id')::uuid and quiz_id=parent returning id into result;
   if result is null then raise exception 'Question not found in this draft quiz.'; end if;
   update private.question_answers set correct_option=(p_data->>'correct_option')::integer,explanation=p_data->>'explanation' where question_id=result;
   return result;
  end if;
  insert into public.questions(quiz_id,position,prompt,options) values(parent,(p_data->>'position')::integer,p_data->>'prompt',p_data->'options') returning id into result;
  insert into private.question_answers(question_id,correct_option,explanation) values(result,(p_data->>'correct_option')::integer,p_data->>'explanation');
 elsif p_kind='publish_quiz' then
  result := (p_data->>'id')::uuid;
  select * into strict q from public.quizzes where id=result for update;
  select count(*) into count_q from public.questions where quiz_id=result;
  if count_q<1 then raise exception 'Add at least one question before publishing this quiz.'; end if;
  if (select max(position) from public.questions where quiz_id=result)<>count_q-1 or
   exists(select 1 from public.questions qs left join private.question_answers a on a.question_id=qs.id where qs.quiz_id=result and a.question_id is null) then raise exception 'Number questions consecutively from 1, with four answers and one correct answer for each.'; end if;
  update public.quizzes set published=true where id=result;
 elsif p_kind='publish_tournament' then
  -- Take the global publication lock before any tournament row lock.
  perform pg_advisory_xact_lock(20261109);
  result := (p_data->>'id')::uuid;
  select * into strict t from public.tournaments where id=result for update;
  if not exists(select 1 from public.matches where tournament_id=result) then raise exception 'Add at least one match before publishing this tournament.'; end if;
  if not exists(select 1 from public.quizzes where tournament_id=result and published) then raise exception 'Publish at least one quiz before publishing this tournament.'; end if;
  -- A single current event; previously published events remain available for season history.
  update public.tournaments set active=false where active;
  update public.tournaments set published=true,active=true where id=result;
 else raise exception 'Unknown admin action.';
 end if;
 return result;
exception
 when unique_violation then raise exception 'That name or question number is already used. Edit the existing item or choose another.';
 when check_violation then raise exception 'Check the fields: end times must follow start times, athletes must differ, and question numbers must be 1–50.';
 when no_data_found or foreign_key_violation then raise exception 'Choose an existing season, tournament or quiz and try again.';
end $$;

create or replace function public.v1_settle_match(p_match_id uuid, p_winner text) returns void language plpgsql security definer set search_path = '' as $$
declare m public.matches;
begin
 perform private.require_content_editor();
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
