create table private.tournament_results (
  tournament_id uuid primary key references public.tournaments(id),
  standings jsonb not null
);
alter table private.tournament_results enable row level security;
revoke all on private.tournament_results from public, anon, authenticated;

create function private.tournament_boards(event_id uuid, cutoff timestamptz default null) returns jsonb
language sql stable set search_path = '' as $$
 with fan_totals as (
   select user_id, sum(xp) points from public.xp_ledger
   where tournament_id=event_id and (cutoff is null or awarded_at <= cutoff) group by user_id having sum(xp)>0
 ), memberships as (
   select 'countries' league, country id, user_id, sum(xp) points from public.xp_ledger
   where tournament_id=event_id and (cutoff is null or awarded_at <= cutoff) group by country,user_id
   union all
   select 'teams', team_id::text, user_id, sum(xp) from public.xp_ledger
   where tournament_id=event_id and team_id is not null and (cutoff is null or awarded_at <= cutoff) group by team_id,user_id
 ), contributors as (
   select *, row_number() over(partition by league,id order by points desc,user_id) position
   from memberships where points>0
 ), totals as (
   select league,id, sum(points) filter(where position<=10) xp,count(*) fans
   from contributors group by league,id
 ), entries as (
   select 'players' league,p.id::text id,p.username name,f.points xp,1::bigint fans
   from fan_totals f join public.profiles p on p.id=f.user_id
   union all
   select t.league,t.id,coalesce(tm.name,t.id),t.xp,t.fans
   from totals t left join public.teams tm on tm.id::text=t.id and t.league='teams'
 ), ranked as (
   select *,rank() over(partition by league order by xp desc) rank,
     lag(xp) over(partition by league order by xp desc,id)-xp gap
   from entries
 ), lists as (
   select league,jsonb_agg(to_jsonb(ranked)-'league' order by rank,id) rows
   from ranked group by league
 )
 select '{"countries":[],"teams":[],"players":[]}'::jsonb ||
        coalesce(jsonb_object_agg(league,rows),'{}'::jsonb) from lists;
$$;

create function public.v1_tournament_rankings() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare event public.tournaments; boards jsonb; current_id uuid; current_boards jsonb; past jsonb;
begin
 -- Serialize with publication and match creation before deciding an event is final.
 perform pg_advisory_xact_lock(20261109);
 select id into current_id from public.tournaments where active and published;
 for event in
   select t.* from public.tournaments t
   where t.published and t.ends_at <= clock_timestamp()
     and not exists(select 1 from public.matches m where m.tournament_id=t.id and m.winner is null)
     and not exists(select 1 from private.tournament_results r where r.tournament_id=t.id)
   order by t.id for update of t
 loop
   if not exists(select 1 from public.matches m where m.tournament_id=event.id and m.winner is null) then
     boards := private.tournament_boards(event.id, greatest(event.ends_at,
       (select max(m.settled_at) from public.matches m where m.tournament_id=event.id)));
     if jsonb_array_length(boards->'players') > 0 then
       insert into private.tournament_results values(event.id,boards) on conflict do nothing;
     end if;
   end if;
 end loop;
 select standings into boards from private.tournament_results where tournament_id=current_id;
 current_boards := coalesce(boards, private.tournament_boards(current_id));
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'winners',
   jsonb_build_object(
     'players',jsonb_path_query_array(r.standings,'$.players[*] ? (@.rank == 1)'),
     'teams',jsonb_path_query_array(r.standings,'$.teams[*] ? (@.rank == 1)'),
     'countries',jsonb_path_query_array(r.standings,'$.countries[*] ? (@.rank == 1)')))
   order by t.ends_at desc,t.id),'[]'::jsonb) into past
 from private.tournament_results r join public.tournaments t on t.id=r.tournament_id
 where t.id is distinct from current_id and t.published;
 return jsonb_build_object('tournament_id',current_id,'final',boards is not null,'boards',current_boards,'past',past);
end $$;
revoke all on function private.tournament_boards(uuid,timestamptz), public.v1_tournament_rankings() from public, anon, authenticated;
grant execute on function public.v1_tournament_rankings() to anon, authenticated;
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
  if t.published then
   if exists(select 1 from private.tournament_results where tournament_id=t.id)
      or t.ends_at <= clock_timestamp() then raise exception 'Match cannot be added to a finished tournament.'; end if;
   if (p_data->>'closes_at')::timestamptz <= clock_timestamp()
     then raise exception 'Match close time must be in the future.'; end if;
  end if;
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
