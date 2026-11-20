-- Browser scores cannot be replayed or fully trusted. Server-issued runs,
-- plausibility checks and a personal 24-hour 20-XP cap bound lifetime XP.
alter table public.xp_ledger drop constraint xp_ledger_source_type_check;
alter table public.xp_ledger add constraint xp_ledger_source_type_check check(source_type in ('quiz','prediction','outright','game'));
alter table public.xp_ledger alter column tournament_id drop not null, alter column season_id drop not null;
alter table public.xp_ledger add constraint xp_ledger_game_scope check(
 (source_type='game' and tournament_id is null and season_id is null)
 or (source_type<>'game' and tournament_id is not null and season_id is not null)
);
create table public.game_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id), team_id uuid references public.teams(id),
 country text not null, day date not null,
 started_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
 level_reached integer check(level_reached between 1 and 99),
 hits integer check(hits>=0), score integer check(score>=0), duration_ms integer check(duration_ms>=0),
 accepted boolean, reject_reason text, xp_added integer not null default 0 check(xp_added between 0 and 20),
 xp_window_started_at timestamptz, finish_result jsonb
);
create index game_runs_player_day on public.game_runs(user_id,day);
create index game_runs_country on public.game_runs(day,country,level_reached desc);
create index game_runs_today on public.game_runs(accepted,day,score desc);
create index game_runs_best on public.game_runs(user_id,score desc);
alter table public.game_runs enable row level security;
revoke all on public.game_runs from public,anon,authenticated;
grant select on public.game_runs to authenticated;
create policy game_runs_own on public.game_runs for select to authenticated using(user_id=(select auth.uid()) or private.is_admin());

create function private.game_hits_for_level(p_level int) returns int
language sql immutable set search_path='' as $$
 select coalesce(sum(case when k<=12 then (array[10,12,15,18,20,22,25,25,28,30,30,30])[k] else 30 end),0)::integer
 from generate_series(1,p_level-1) k;
$$;
create function public.v1_game_start() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_player(); p public.profiles; n timestamptz:=clock_timestamp(); d date; run uuid;
begin
 select * into strict p from public.profiles where id=u for no key update;
 n:=clock_timestamp(); d:=(n at time zone 'utc')::date;
 if exists(select 1 from public.game_runs where user_id=u and started_at>n-interval '3 seconds') then
  raise exception 'Give it a moment before starting again.';
 end if;
 if (select count(*) from public.game_runs where user_id=u and day=d)>=300 then raise exception 'Come back tomorrow for more Smash Up.'; end if;
 insert into public.game_runs(user_id,team_id,country,day,started_at) values(u,p.team_id,p.country,d,n) returning id into run;
 return jsonb_build_object('run_id',run,'seed',floor(random()*2147483647)::integer,'server_now',n);
end $$;

create function public.v1_game_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_player(); anchor timestamptz; total integer; d date:=(clock_timestamp() at time zone 'utc')::date;
begin
 select max(xp_window_started_at) into anchor from public.game_runs where user_id=u and accepted and xp_added>0 and xp_window_started_at>clock_timestamp()-interval '24 hours';
 select coalesce(sum(xp),0) into total from public.xp_ledger where user_id=u and source_type='game' and source_id in (
   select md5(u::text||'|'||extract(epoch from anchor)::text||'|'||k)::uuid from generate_series(1,3) k);
 return jsonb_build_object('day',d,'xp_today',total,'xp_cap',20,'resets_at',anchor+interval '24 hours',
  'last_played',(select max(started_at) from public.game_runs where user_id=u),
  'best_level_today',(select level_reached from public.game_runs where user_id=u and accepted and day=d order by score desc,level_reached desc,finished_at,id limit 1),
  'best_score_today',(select max(score) from public.game_runs where user_id=u and accepted and day=d));
end $$;

create function public.v1_game_finish(p_run_id uuid,p_level int,p_hits int,p_duration_ms int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_player(); r public.game_runs; elapsed_ms numeric; n timestamptz; reason text;
 anchor timestamptz; k integer; points integer; added integer:=0; inserted integer; total integer; result jsonb;
begin
 -- Serialize all finishes for this player, including runs started in parallel.
 perform 1 from public.profiles where id=u for no key update;
 select * into r from public.game_runs where id=p_run_id and user_id=u for update;
 if not found then raise exception 'Run not found.'; end if;
 if r.finished_at is not null then return r.finish_result; end if;
 n:=clock_timestamp(); elapsed_ms:=extract(epoch from n-r.started_at)*1000;
 if elapsed_ms>1800000 then reason:='Run expired.';
 elsif p_duration_ms is null or p_duration_ms<0 or p_duration_ms>elapsed_ms+2000 or p_duration_ms<elapsed_ms*.8-5000 then reason:='Run time could not be verified.';
 elsif p_level is null or p_level not between 1 and 99 then reason:='Level could not be verified.';
 elsif p_hits is null or p_hits<private.game_hits_for_level(p_level) then reason:='Too few hits for this level.';
 elsif p_hits>p_duration_ms/800 or p_duration_ms<800*private.game_hits_for_level(p_level) then reason:='Hits could not be verified.';
 end if;
 select max(xp_window_started_at) into anchor from public.game_runs where user_id=u and accepted and xp_added>0 and xp_window_started_at>n-interval '24 hours';
 if reason is null and (p_hits>=5 or p_level>=2) then
  anchor:=coalesce(anchor,n);
  for k in 1..3 loop
   if (k=1 and p_hits>=5) or (k=2 and p_level>=2) or (k=3 and p_level>=3) then
    points:=case when k=3 then 10 else 5 end;
    insert into public.xp_ledger(user_id,tournament_id,season_id,team_id,country,source_type,source_id,xp)
    values(u,null,null,r.team_id,r.country,'game',md5(u::text||'|'||extract(epoch from anchor)::text||'|'||k)::uuid,points)
    on conflict(user_id,source_type,source_id) do nothing;
    get diagnostics inserted = row_count;
    added:=added+inserted*points;
   end if;
  end loop;
 end if;
 select coalesce(sum(xp),0) into total from public.xp_ledger where user_id=u and source_type='game' and source_id in (
   select md5(u::text||'|'||extract(epoch from anchor)::text||'|'||i)::uuid from generate_series(1,3) i);
 result:=jsonb_build_object('accepted',reason is null,'reason',reason,'level_reached',p_level,
  'score',case when reason is null then p_hits+10*(p_level-1) else 0 end,'xp_added',added,'xp_today',total,'xp_cap',20,'resets_at',anchor+interval '24 hours');
 update public.game_runs set finished_at=n,level_reached=case when p_level between 1 and 99 then p_level else null end,
  hits=case when p_hits>=0 then p_hits else null end,score=case when reason is null then p_hits+10*(p_level-1) else 0 end,
  duration_ms=case when p_duration_ms>=0 then p_duration_ms else null end,
  accepted=reason is null,reject_reason=reason,xp_added=added,xp_window_started_at=anchor,finish_result=result where id=r.id;
 return result;
end $$;

create function public.v1_smash_leaderboard(p_scope text default 'today') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_scope is null or p_scope not in ('today','all') then raise exception 'Invalid leaderboard.'; end if;
 with best as (
  select distinct on(r.user_id) r.user_id,r.level_reached,r.hits,r.score,r.finished_at
  from public.game_runs r where r.accepted and (p_scope='all' or r.day=(statement_timestamp() at time zone 'utc')::date)
  order by r.user_id,r.score desc,r.level_reached desc,r.finished_at,r.id
 ), ranked as (
  select b.user_id,rank() over(order by b.score desc) rank,p.username,p.country,
   b.level_reached best_level,b.hits best_hits,b.score best_score,(b.finished_at at time zone 'utc')::date achieved_on,b.finished_at
  from best b join public.profiles p on p.id=b.user_id
 ), ordered as (select * from ranked order by best_score desc,best_level desc,finished_at,user_id limit 50)
 select jsonb_build_object('scope',p_scope,'day',(statement_timestamp() at time zone 'utc')::date,
  'rows',(select coalesce(jsonb_agg(to_jsonb(o)-'user_id'-'finished_at' order by best_score desc,best_level desc,finished_at,user_id),'[]') from ordered o),
  'me',(select to_jsonb(r)-'user_id'-'finished_at' from ranked r where r.user_id=auth.uid())) into result;
 return result;
end $$;

create function public.v1_smash_country_board() returns table(country text,best_level int,best_score int,fans bigint,top_fan text)
language sql stable security definer set search_path='' as $$
 with runs as (
  select p.country,p.username,r.user_id,r.level_reached,r.score,r.finished_at,r.id
  from public.game_runs r join public.profiles p on p.id=r.user_id
  where r.accepted and r.day=(statement_timestamp() at time zone 'utc')::date
 ), counts as (select country,count(distinct user_id) fans from runs group by country),
 best as (select distinct on(country) country,level_reached,score,username from runs order by country,score desc,level_reached desc,finished_at,id)
 select b.country,b.level_reached,b.score,c.fans,b.username from best b join counts c using(country)
 order by b.score desc,b.level_reached desc,b.country limit 20;
$$;
revoke all on function private.game_hits_for_level(int),public.v1_game_start(),public.v1_game_finish(uuid,int,int,int),
 public.v1_game_status(),public.v1_smash_leaderboard(text),public.v1_smash_country_board() from public,anon,authenticated;
grant execute on function public.v1_game_start(),public.v1_game_finish(uuid,int,int,int),public.v1_game_status() to authenticated;
grant execute on function public.v1_smash_leaderboard(text),public.v1_smash_country_board() to anon,authenticated;
