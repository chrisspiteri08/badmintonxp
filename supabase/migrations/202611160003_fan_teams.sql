alter table public.teams
  add column invite_code text not null default left(replace(gen_random_uuid()::text, '-', ''), 12) unique,
  add column archived_at timestamptz;
create unique index teams_name_casefold on public.teams (lower(btrim(name))) where archived_at is null;
alter table public.teams drop constraint teams_name_key;
alter policy teams_read on public.teams using (archived_at is null);
create index profiles_team_members on public.profiles(team_id) where team_id is not null;

create table private.fan_teams (
  team_id uuid primary key references public.teams(id),
  captain_id uuid not null,
  tournament_id uuid not null references public.tournaments(id),
  created_at timestamptz not null default now(),
  unique (captain_id, tournament_id)
);
create table private.team_creation_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null
);
alter table private.fan_teams enable row level security;
alter table private.team_creation_limits enable row level security;
revoke all on private.fan_teams, private.team_creation_limits from public, anon, authenticated;

create function private.fan_team_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select case when char_length(candidate) between 3 and 30
    and candidate !~ '[[:cntrl:]]'
    and candidate !~* '(^|[^[:alnum:]])(fuck[a-z]*|shit[a-z]*|bitch[a-z]*|asshole[a-z]*|dick|cunt[a-z]*)([^[:alnum:]]|$)'
    then candidate end
  from (select regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g') candidate) name;
$$;

create function private.team_invite_payload(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', t.id, 'name', t.name, 'invite_code', t.invite_code,
    'member_count', (select count(*) from public.profiles p where p.team_id=t.id))
  from public.teams t where t.id=p_id and t.archived_at is null;
$$;

create function public.v1_team_invite(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.team_invite_payload(id) from public.teams
  where invite_code=lower(p_code) and archived_at is null;
$$;

create function public.v1_my_team() returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.team_invite_payload(team_id) from public.profiles where id=auth.uid();
$$;

create function public.v1_create_fan_team(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  player uuid := private.require_player();
  team_name text := private.fan_team_name(p_name);
  event_id uuid;
  existing public.teams;
  created_team uuid;
  request_count integer;
  opened_at timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(20261116);
  perform 1 from public.profiles where id=player for no key update;
  insert into private.team_creation_limits as throttle values (player, opened_at, 1)
  on conflict (user_id) do update set
    requests = case when throttle.window_start <= opened_at - interval '1 minute' then 1 else throttle.requests + 1 end,
    window_start = case when throttle.window_start <= opened_at - interval '1 minute' then opened_at else throttle.window_start end
  returning requests into request_count;
  if request_count > 5 then
    return jsonb_build_object('error','Please wait a minute before trying to create a team again.');
  end if;
  -- Serialize the event selection with tournament publication.
  perform pg_advisory_xact_lock(20261109);
  select id into event_id from public.tournaments where active and published;
  if event_id is null then
    return jsonb_build_object('error','Team creation opens when a tournament is active.');
  end if;
  if team_name is null then
    return jsonb_build_object('error','Use a team name with 3–30 characters and no profanity.');
  end if;
  select t.* into existing from private.fan_teams f join public.teams t on t.id=f.team_id
  where f.captain_id=player and f.tournament_id=event_id;
  if found then
    -- Repeating an already successful signup request returns the same team.
    if existing.archived_at is null and lower(existing.name)=lower(team_name)
      and exists(select 1 from public.profiles p where p.id=player and p.team_id=existing.id) then
      return private.team_invite_payload(existing.id);
    end if;
    return jsonb_build_object('error','You can create one team per tournament.');
  end if;
  insert into public.teams(name) values(team_name)
  on conflict (lower(btrim(name))) where archived_at is null do nothing returning id into created_team;
  if created_team is null then
    return jsonb_build_object('error','That team name is taken.');
  end if;
  insert into private.fan_teams values(created_team, player, event_id, opened_at);
  update public.profiles set team_id=created_team where id=player;
  return private.team_invite_payload(created_team);
end $$;

create function public.v1_join_fan_team(p_code text, p_confirm_switch boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare player uuid := private.require_player(); previous_team uuid; next_team uuid;
begin
  perform pg_advisory_xact_lock(20261116);
  select team_id into previous_team from public.profiles where id=player for no key update;
  select id into next_team from public.teams where invite_code=lower(p_code) and archived_at is null;
  if next_team is null then return jsonb_build_object('error','This team invite is no longer available.'); end if;
  if previous_team is not null and previous_team <> next_team and p_confirm_switch is distinct from true then
    return jsonb_build_object('confirm_switch',true);
  end if;
  update public.profiles set team_id=next_team where id=player and team_id is distinct from next_team;
  return private.team_invite_payload(next_team);
end $$;

create function public.v1_admin_fan_teams() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return (select coalesce(jsonb_agg(
    jsonb_build_object('id',t.id,'name',t.name,'creator',coalesce(p.username,'Former player'),
      'created_at',f.created_at,
      'member_count',(select count(*) from public.profiles m where m.team_id=t.id))
    order by f.created_at desc),'[]'::jsonb)
    from private.fan_teams f join public.teams t on t.id=f.team_id
    left join public.profiles p on p.id=f.captain_id where t.archived_at is null);
end $$;

create function public.v1_admin_moderate_team(p_id uuid, p_name text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare team_name text := private.fan_team_name(p_name);
begin
  perform private.require_admin();
  perform pg_advisory_xact_lock(20261116);
  if not exists(select 1 from private.fan_teams f join public.teams t on t.id=f.team_id
    where f.team_id=p_id and t.archived_at is null) then
    raise exception 'Tournament desk: this team is no longer available.';
  end if;
  if p_name is null then
    -- Preserve the team ID for the historical XP ledger while closing the invite.
    update public.profiles set team_id=null where team_id=p_id;
    update public.teams set archived_at=clock_timestamp(), name='Removed team' where id=p_id;
  elsif team_name is null then
    raise exception 'Tournament desk: use a team name with 3–30 characters and no profanity.';
  else
    update public.teams set name=team_name where id=p_id;
  end if;
exception when unique_violation then
  raise exception 'Tournament desk: that team name is taken.';
end $$;

revoke all on function private.fan_team_name(text), private.team_invite_payload(uuid) from public, anon, authenticated;
revoke all on function public.v1_team_invite(text), public.v1_my_team(), public.v1_create_fan_team(text),
 public.v1_join_fan_team(text,boolean), public.v1_admin_fan_teams(), public.v1_admin_moderate_team(uuid,text)
 from public, anon, authenticated;
grant execute on function public.v1_team_invite(text) to anon, authenticated;
grant execute on function public.v1_my_team(), public.v1_create_fan_team(text),
 public.v1_join_fan_team(text,boolean), public.v1_admin_fan_teams(), public.v1_admin_moderate_team(uuid,text)
 to authenticated;

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
 (exists(select 1 from public.attempts where user_id=u) or exists(select 1 from public.predictions where user_id=u)) then
  raise exception 'Your team and country are locked once you start playing.';
 end if;
 update public.profiles set username=trim(p_username), country=p_country, team_id=p_team_id where id=u returning * into p;
 return to_jsonb(p);
end $$;

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
 'lifetime_xp',(select coalesce(sum(xp),0) from public.xp_ledger where user_id=u),
 'event_xp',(select coalesce(sum(xp),0) from public.xp_ledger where user_id=u and tournament_id=t.id));
end $$;

create or replace function private.new_player() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_name text := trim(metadata->>'username');
  requested_country text := metadata->>'country';
  requested_team uuid;
begin
  select id into requested_team from public.teams
  where id::text = metadata->>'team_id' and archived_at is null for share;

  if requested_name ~ '^[A-Za-z0-9_]{3,24}$' then
    insert into public.profiles (id, username, country, team_id)
    values (new.id, requested_name,
      case when requested_country ~ '^[A-Z]{2}$' then requested_country else 'MY' end,
      requested_team)
    on conflict (lower(username)) do nothing;
    if found then return new; end if;
  end if;

  insert into public.profiles (id, username, country, team_id)
  values (new.id, 'player_' || left(replace(new.id::text,'-',''),17),
    case when requested_country ~ '^[A-Z]{2}$' then requested_country else 'MY' end,
    requested_team);
  return new;
end $$;
