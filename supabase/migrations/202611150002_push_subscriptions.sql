create table public.push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text primary key check (length(endpoint) <= 2048 and endpoint like 'https://%'),
  keys jsonb not null check (
    jsonb_typeof(keys) = 'object'
    and coalesce(keys->>'p256dh','') ~ '^[A-Za-z0-9_-]{87}$'
    and coalesce(keys->>'auth','') ~ '^[A-Za-z0-9_-]{22}$'
  ),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy push_own_subscription on public.push_subscriptions for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.v1_push_recipients(p_after text default '', p_expired text[] default null)
returns table(endpoint text, keys jsonb)
language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Admin access required.' using errcode='42501'; end if;
 if p_expired is not null then
   delete from public.push_subscriptions s where s.endpoint = any(p_expired);
   return;
 end if;
 return query select s.endpoint,s.keys from public.push_subscriptions s
   where s.endpoint > p_after order by s.endpoint limit 100;
end $$;
revoke all on function public.v1_push_recipients(text,text[]) from public, anon, authenticated;
grant execute on function public.v1_push_recipients(text,text[]) to authenticated;
