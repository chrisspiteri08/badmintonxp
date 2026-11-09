-- Owner instruction: World Tour Finals 2026 must remain unpublished until explicit approval.
-- Do not remove this trigger as part of setup. Releasing the hold needs a separate approved change.
create function private.hold_world_tour_finals_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if lower(regexp_replace(trim(new.name), '[[:space:]]+', ' ', 'g')) = 'world tour finals 2026'
    and (new.published or new.active) then
  raise exception 'World Tour Finals 2026 publication is on hold until owner approval.';
 end if;
 return new;
end $$;
revoke all on function private.hold_world_tour_finals_publication() from public, anon, authenticated;
create trigger v1_world_tour_finals_hold before insert or update on public.tournaments
for each row execute function private.hold_world_tour_finals_publication();
-- If draft setup was already performed in the NEW v1 project, make its status explicit.
update public.tournaments set published=false,active=false
where lower(regexp_replace(trim(name), '[[:space:]]+', ' ', 'g')) = 'world tour finals 2026';
