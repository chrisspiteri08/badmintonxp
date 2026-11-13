create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254),
  consent_at timestamptz not null default now(),
  source text not null default 'hangzhou-launch' check (source = 'hangzhou-launch'),
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;
revoke all on public.waitlist_signups from public, anon, authenticated;
grant insert (email) on public.waitlist_signups to anon;
create policy waitlist_anon_insert on public.waitlist_signups for insert to anon
  with check (true);
