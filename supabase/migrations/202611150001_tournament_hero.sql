alter table public.tournaments
 add column city text check (length(city) <= 100),
 add column hero_image_url text check (length(hero_image_url) <= 2048 and hero_image_url ~ '^https://[^[:space:]/]+'),
 add column hero_image_alt text check (length(hero_image_alt) <= 200),
 add constraint tournament_hero_alt_required check (
   hero_image_url is null or nullif(btrim(hero_image_alt),'') is not null
 );

alter table public.matches
 add column opens_at timestamptz check (opens_at is null or opens_at < closes_at);

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
 elsif p_kind='tournament_hero' then
  result := (p_data->>'tournament_id')::uuid;
  update public.tournaments
  set city=nullif(btrim(p_data->>'city'),''),
      hero_image_url=nullif(btrim(p_data->>'hero_image_url'),''),
      hero_image_alt=nullif(btrim(p_data->>'hero_image_alt'),'')
  where id=result returning id into result;
  if result is null then raise exception 'Choose an existing tournament.'; end if;
 elsif p_kind='match' then
  parent := (p_data->>'tournament_id')::uuid;
  select * into strict t from public.tournaments where id=parent for update;
  if t.published then
   if exists(select 1 from private.tournament_results where tournament_id=t.id)
      or t.ends_at <= clock_timestamp() then raise exception 'Match cannot be added to a finished tournament.'; end if;
   if (p_data->>'closes_at')::timestamptz <= clock_timestamp()
     then raise exception 'Match close time must be in the future.'; end if;
  end if;
  insert into public.matches(tournament_id,athlete_a,athlete_b,opens_at,closes_at) values(parent,p_data->>'athlete_a',p_data->>'athlete_b',nullif(p_data->>'opens_at','')::timestamptz,(p_data->>'closes_at')::timestamptz) returning id into result;
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

create or replace function public.v1_predict(p_match_id uuid, p_pick text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_player(); m public.matches; p public.profiles; entry public.predictions;
begin
 select * into strict p from public.profiles where id=u for no key update;
 select * into m from public.matches where id=p_match_id for update;
 if not found or not exists(select 1 from public.tournaments where id=m.tournament_id and published) then raise exception 'Match is not available.'; end if;
 select * into entry from public.predictions where user_id=u and match_id=m.id;
 if found then return to_jsonb(entry); end if;
 if m.opens_at is not null and clock_timestamp() < m.opens_at then raise exception 'Predictions are not open yet.'; end if;
 if clock_timestamp() >= m.closes_at or m.winner is not null then raise exception 'Predictions are closed.'; end if;
 if p_pick not in (m.athlete_a,m.athlete_b) or p_pick is null then raise exception 'Choose an athlete.'; end if;
 insert into public.predictions(user_id,match_id,pick,team_id,country) values(u,m.id,p_pick,p.team_id,p.country) returning * into entry;
 return to_jsonb(entry);
end $$;
