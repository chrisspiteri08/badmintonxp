insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tournament-heroes', 'tournament-heroes', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy tournament_heroes_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'tournament-heroes');

create policy tournament_heroes_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'tournament-heroes' and (select private.can_manage_content()));

create policy tournament_heroes_update on storage.objects
for update to authenticated
using (bucket_id = 'tournament-heroes' and (select private.can_manage_content()))
with check (bucket_id = 'tournament-heroes' and (select private.can_manage_content()));

create policy tournament_heroes_delete on storage.objects
for delete to authenticated
using (bucket_id = 'tournament-heroes' and (select private.can_manage_content()));
