create table public.outrights (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references public.tournaments(id),
 title text not null check (length(title) between 5 and 120),
 event_label text not null check (length(event_label) between 2 and 40),
 opens_at timestamptz, closes_at timestamptz not null,
 winner_option_id uuid, settled_at timestamptz, voided_at timestamptz,
 created_at timestamptz not null default now(),
 check (opens_at is null or opens_at < closes_at),
 check ((winner_option_id is null) = (settled_at is null)),
 check (not (settled_at is not null and voided_at is not null))
);
create table public.outright_options (
 id uuid primary key default gen_random_uuid(),
 outright_id uuid not null references public.outrights(id) on delete cascade,
 position integer not null check (position between 0 and 31),
 label text not null check (length(label) between 2 and 80),
 unique(outright_id,position), unique(outright_id,id)
);
create unique index outright_option_labels on public.outright_options(outright_id,lower(label));
alter table public.outrights add constraint outright_winner_belongs
 foreign key(id,winner_option_id) references public.outright_options(outright_id,id);
create table public.outright_picks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 outright_id uuid not null references public.outrights(id),
 option_id uuid not null references public.outright_options(id),
 team_id uuid references public.teams(id), country text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,outright_id),
 foreign key(outright_id,option_id) references public.outright_options(outright_id,id)
);
create index outright_pick_item on public.outright_picks(outright_id);
alter table public.outrights enable row level security;
alter table public.outright_options enable row level security;
alter table public.outright_picks enable row level security;
revoke all on public.outrights,public.outright_options,public.outright_picks from public,anon,authenticated;
grant select on public.outrights,public.outright_options to anon,authenticated;
grant select on public.outright_picks to authenticated;
create policy outrights_read on public.outrights for select to anon,authenticated using (
 exists(select 1 from public.tournaments t where t.id=tournament_id and t.published) or private.can_manage_content()
);
create policy outright_options_read on public.outright_options for select to anon,authenticated using (
 exists(select 1 from public.outrights o join public.tournaments t on t.id=o.tournament_id where o.id=outright_id and t.published)
 or private.can_manage_content()
);
create policy outright_picks_own on public.outright_picks for select to authenticated using (
 user_id=(select auth.uid()) or private.is_admin()
);
-- Original declaration in 202611090001_v1.sql uses this PostgreSQL-generated name.
alter table public.xp_ledger drop constraint xp_ledger_source_type_check;
alter table public.xp_ledger add constraint xp_ledger_source_type_check check(source_type in ('quiz','prediction','outright'));

create function public.v1_admin_save_outright(p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare item public.outrights; event public.tournaments; result uuid; labels jsonb := p_data->'options';
begin
 perform private.require_content_editor();
 -- Same publication lock order as finalization, followed by tournament, then item.
 perform pg_advisory_xact_lock(20261109);
 if p_data->>'id' is not null then
  select * into strict item from public.outrights where id=(p_data->>'id')::uuid;
 end if;
 select * into strict event from public.tournaments where id=(p_data->>'tournament_id')::uuid for update;
 if event.published then
  if event.ends_at<=clock_timestamp() or exists(select 1 from private.tournament_results where tournament_id=event.id) then
   raise exception 'Champion picks cannot be added to a finished tournament.';
  end if;
  if (p_data->>'closes_at')::timestamptz<=clock_timestamp() then raise exception 'Pick close time must be in the future.'; end if;
 end if;
 if jsonb_typeof(labels) is distinct from 'array' then raise exception 'Give at least two options.'; end if;
 if jsonb_array_length(labels) not between 2 and 32 then raise exception 'Give two to 32 options.'; end if;
 if exists(select 1 from jsonb_array_elements(labels) label where jsonb_typeof(label)<>'string' or length(btrim(label#>>'{}')) not between 2 and 80) then
  raise exception 'Provide option names with 2–80 characters.';
 end if;
 if (select count(distinct lower(btrim(value))) from jsonb_array_elements_text(labels))<>jsonb_array_length(labels) then
  raise exception 'Options must be different.';
 end if;
 if item.id is not null then
  select * into strict item from public.outrights where id=item.id for update;
  if item.settled_at is not null or item.voided_at is not null or exists(select 1 from public.outright_picks where outright_id=item.id) then
   raise exception 'This pick already has entries or is final; void it and create a new one.';
  end if;
  update public.outrights set tournament_id=event.id,title=btrim(p_data->>'title'),event_label=btrim(p_data->>'event_label'),
   opens_at=nullif(p_data->>'opens_at','')::timestamptz,closes_at=(p_data->>'closes_at')::timestamptz where id=item.id;
  result:=item.id;
  delete from public.outright_options where outright_id=result;
 else
  insert into public.outrights(tournament_id,title,event_label,opens_at,closes_at)
  values(event.id,btrim(p_data->>'title'),btrim(p_data->>'event_label'),nullif(p_data->>'opens_at','')::timestamptz,(p_data->>'closes_at')::timestamptz) returning id into result;
 end if;
 insert into public.outright_options(outright_id,position,label)
 select result,ordinality-1,btrim(value) from jsonb_array_elements_text(labels) with ordinality;
 return result;
exception when check_violation then raise exception 'Check the title, event label and pick times.';
 when no_data_found then raise exception 'Choose an existing tournament or champion pick.';
end $$;

create function public.v1_pick_outright(p_outright_id uuid,p_option_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare player uuid:=private.require_player(); profile public.profiles; item public.outrights; entry public.outright_picks;
begin
 select * into strict profile from public.profiles where id=player for no key update;
 select * into item from public.outrights where id=p_outright_id for update;
 if not found or not exists(select 1 from public.tournaments where id=item.tournament_id and published) then raise exception 'Pick is not available.'; end if;
 if item.voided_at is not null or item.settled_at is not null or clock_timestamp()>=item.closes_at then raise exception 'Picks are closed.'; end if;
 if item.opens_at>clock_timestamp() then raise exception 'Picks are not open yet.'; end if;
 if not exists(select 1 from public.outright_options where id=p_option_id and outright_id=item.id) then raise exception 'Choose an option from this pick.'; end if;
 insert into public.outright_picks(user_id,outright_id,option_id,team_id,country)
 values(player,item.id,p_option_id,profile.team_id,profile.country)
 on conflict(user_id,outright_id) do update set option_id=excluded.option_id,team_id=excluded.team_id,country=excluded.country,updated_at=clock_timestamp()
 returning * into entry;
 return to_jsonb(entry);
end $$;

create function public.v1_settle_outright(p_outright_id uuid,p_option_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare item public.outrights;
begin
 perform private.require_content_editor();
 perform pg_advisory_xact_lock(20261109);
 select * into strict item from public.outrights where id=p_outright_id for update;
 if item.voided_at is not null then raise exception 'This pick was voided.'; end if;
 if item.settled_at is not null then
  if item.winner_option_id=p_option_id then return; end if;
  raise exception 'Result already final. It cannot be changed.';
 end if;
 if clock_timestamp()<item.closes_at then raise exception 'Wait until picks close before entering the champion.'; end if;
 if not exists(select 1 from public.outright_options where id=p_option_id and outright_id=item.id) then raise exception 'Choose an option from this pick.'; end if;
 update public.outrights set winner_option_id=p_option_id,settled_at=clock_timestamp() where id=item.id;
 insert into public.xp_ledger(user_id,tournament_id,season_id,team_id,country,source_type,source_id,xp)
 select pk.user_id,t.id,t.season_id,pk.team_id,pk.country,'outright',o.id,case when pk.option_id=p_option_id then 20 else 0 end
 from public.outright_picks pk join public.outrights o on o.id=pk.outright_id join public.tournaments t on t.id=o.tournament_id
 where o.id=item.id on conflict(user_id,source_type,source_id) do nothing;
end $$;

create function public.v1_void_outright(p_outright_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare item public.outrights;
begin
 perform private.require_content_editor();
 perform pg_advisory_xact_lock(20261109);
 select * into strict item from public.outrights where id=p_outright_id for update;
 if item.settled_at is not null then raise exception 'Result already final. It cannot be changed.'; end if;
 update public.outrights set voided_at=coalesce(voided_at,clock_timestamp()) where id=item.id;
end $$;
revoke all on function public.v1_admin_save_outright(jsonb),public.v1_pick_outright(uuid,uuid),
 public.v1_settle_outright(uuid,uuid),public.v1_void_outright(uuid) from public,anon,authenticated;
grant execute on function public.v1_admin_save_outright(jsonb),public.v1_pick_outright(uuid,uuid),
 public.v1_settle_outright(uuid,uuid),public.v1_void_outright(uuid) to authenticated;

create or replace function public.v1_home() returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); t public.tournaments;
begin
 select * into t from public.tournaments where active and published;
 return jsonb_build_object('server_now',clock_timestamp(),'admin',private.is_admin(),'content_editor',private.can_manage_content(),
 'profile',(select to_jsonb(p) from public.profiles p where p.id=u),
 'teams',(select coalesce(jsonb_agg(jsonb_build_object('id',tm.id,'name',tm.name,'invite_code',tm.invite_code) order by tm.name),'[]'::jsonb) from public.teams tm where tm.archived_at is null),
 'tournament',case when t.id is null then null else to_jsonb(t) end,
 'quizzes',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'opens_at',q.opens_at,'closes_at',q.closes_at,
  'question_count',(select count(*) from public.questions where quiz_id=q.id),
  'attempt',(select jsonb_build_object('complete',a.complete,'score',(select coalesce(sum(xp),0) from public.attempt_answers where attempt_id=a.id)) from public.attempts a where a.quiz_id=q.id and a.user_id=u)) order by q.opens_at),'[]'::jsonb)
  from public.quizzes q where q.tournament_id=t.id and q.published),
 'matches',(select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('entry',(select to_jsonb(pr) from public.predictions pr where pr.match_id=m.id and pr.user_id=u)) order by m.closes_at),'[]'::jsonb) from public.matches m where m.tournament_id=t.id),
 'outrights',(select coalesce(jsonb_agg(jsonb_build_object(
  'id',o.id,'title',o.title,'event_label',o.event_label,'opens_at',o.opens_at,'closes_at',o.closes_at,
  'winner_option_id',o.winner_option_id,'settled_at',o.settled_at,'voided_at',o.voided_at,
  'options',(select coalesce(jsonb_agg(op order by op.position),'[]') from public.outright_options op where op.outright_id=o.id),
  'entry',(select jsonb_build_object('option_id',pk.option_id,'updated_at',pk.updated_at) from public.outright_picks pk where pk.outright_id=o.id and pk.user_id=u)
 ) order by o.closes_at),'[]') from public.outrights o where o.tournament_id=t.id),
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
 'outrights',(select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object(
  'options',(select coalesce(jsonb_agg(op order by op.position),'[]') from public.outright_options op where op.outright_id=o.id),
  'pick_count',(select count(*) from public.outright_picks pk where pk.outright_id=o.id)) order by o.closes_at),'[]') from public.outrights o),
 'players',case when private.is_admin() then (select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('email',u.email)),'[]') from public.profiles p join auth.users u on u.id=p.id) else '[]'::jsonb end);
end $$;

create or replace function public.v1_tournament_rankings() returns jsonb
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
     and not exists(select 1 from public.outrights o where o.tournament_id=t.id and o.settled_at is null and o.voided_at is null)
     and not exists(select 1 from private.tournament_results r where r.tournament_id=t.id)
   order by t.id for update of t
 loop
   if not exists(select 1 from public.matches m where m.tournament_id=event.id and m.winner is null) and not exists(select 1 from public.outrights o where o.tournament_id=event.id and o.settled_at is null and o.voided_at is null) then
     boards := private.tournament_boards(event.id, greatest(event.ends_at,
       (select max(m.settled_at) from public.matches m where m.tournament_id=event.id),
       (select max(o.settled_at) from public.outrights o where o.tournament_id=event.id)));
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
create or replace function public.v1_profile(p_username text, p_country text, p_team_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_player(); p public.profiles;
begin
 perform pg_advisory_xact_lock(20261116);
 if p_team_id is not null and not exists(select 1 from public.teams where id=p_team_id and archived_at is null) then
  raise exception 'Choose a team that is still available.';
 end if;
 select * into p from public.profiles where id=u for no key update;
 if (p.team_id is distinct from p_team_id or p.country <> p_country) and
 (exists(select 1 from public.attempts where user_id=u) or exists(select 1 from public.predictions where user_id=u) or exists(select 1 from public.outright_picks where user_id=u)) then
  raise exception 'Your team and country are locked once you start playing.';
 end if;
 update public.profiles set username=trim(p_username), country=p_country, team_id=p_team_id where id=u returning * into p;
 return to_jsonb(p);
end $$;

