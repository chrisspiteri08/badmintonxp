create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
revoke all on public.feedback from public, anon, authenticated;
grant insert (tournament_id, rating, comment), select on public.feedback to authenticated;

create policy feedback_submit on public.feedback for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.tournaments t
    where t.id = tournament_id and t.active and t.published
    and lower(regexp_replace(trim(t.name), '[[:space:]]+', ' ', 'g'))
      !~ '^world tour finals( [0-9]{4})?$'
  )
);

create policy feedback_admin_read on public.feedback for select to authenticated
using ((select private.is_admin()));

-- Save registration choices before email confirmation. Keep the generated name
-- when a requested username is malformed or already taken.
create or replace function private.new_player() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_name text := trim(metadata->>'username');
  requested_country text := metadata->>'country';
  requested_team uuid;
begin
  select id into requested_team from public.teams
  where id::text = metadata->>'team_id';

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
