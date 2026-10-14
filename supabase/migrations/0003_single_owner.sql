-- Single-owner lockdown.
-- DevNotes V1 has exactly one owner. Even if public sign-up is accidentally left
-- on in Supabase Auth, other accounts can never write anything, and only the
-- owner's PUBLIC + PUBLISHED notes are ever readable by visitors.
--
-- Owner = the row in app_settings, which this migration fills with the oldest
-- auth user (the account you created first). To change it:
--   update public.app_settings set owner_id = '<user uuid>' where id = 1;
--
-- Run after 0001 and 0002. Safe to run more than once.

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  owner_id uuid not null references auth.users (id) on delete cascade
);

-- RLS on with no policies: not readable or writable through the API at all.
alter table public.app_settings enable row level security;

insert into public.app_settings (id, owner_id)
select 1, id from auth.users order by created_at asc limit 1
on conflict (id) do nothing;

create or replace function public.app_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.app_settings where id = 1;
$$;

create or replace function public.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and auth.uid() = public.app_owner_id();
$$;

grant execute on function public.is_app_owner() to anon, authenticated;
revoke all on function public.app_owner_id() from public;
grant execute on function public.app_owner_id() to anon, authenticated;

-- ── Public-visibility helpers: only the owner's content counts ──
create or replace function public.is_public_note(p_note_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from notes
    where id = p_note_id and visibility = 'PUBLIC' and status = 'PUBLISHED' and user_id = public.app_owner_id()
  );
$$;

create or replace function public.is_public_tag(p_tag_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from note_tags nt join notes n on n.id = nt.note_id
    where nt.tag_id = p_tag_id and n.visibility = 'PUBLIC' and n.status = 'PUBLISHED' and n.user_id = public.app_owner_id()
  );
$$;

create or replace function public.is_public_category(p_category_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from notes
    where category_id = p_category_id and visibility = 'PUBLIC' and status = 'PUBLISHED' and user_id = public.app_owner_id()
  );
$$;

create or replace function public.is_public_attachment(p_storage_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from note_attachments a join notes n on n.id = a.note_id
    where a.storage_path = p_storage_path and n.visibility = 'PUBLIC' and n.status = 'PUBLISHED'
      and n.user_id = public.app_owner_id()
  );
$$;

-- Slug lookup can see every row, so only the owner may call it (it also runs
-- from the notes trigger, which only the owner can reach).
create or replace function public.next_note_slug(base text, current_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text := public.slugify(base);
  root text := candidate;
  n integer := 1;
begin
  if not public.is_app_owner() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  while exists (select 1 from public.notes where slug = candidate and id <> current_id) loop
    n := n + 1;
    candidate := root || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- ── Table policies ─────────────────────────────────────────────
drop policy if exists "notes: public read published" on public.notes;
create policy "notes: public read published" on public.notes
  for select using (visibility = 'PUBLIC' and status = 'PUBLISHED' and user_id = public.app_owner_id());

drop policy if exists "notes: owner read" on public.notes;
create policy "notes: owner read" on public.notes
  for select to authenticated using (user_id = auth.uid() and public.is_app_owner());

drop policy if exists "notes: owner insert" on public.notes;
create policy "notes: owner insert" on public.notes
  for insert to authenticated with check (user_id = auth.uid() and public.is_app_owner());

drop policy if exists "notes: owner update" on public.notes;
create policy "notes: owner update" on public.notes
  for update to authenticated
  using (user_id = auth.uid() and public.is_app_owner())
  with check (user_id = auth.uid() and public.is_app_owner());

drop policy if exists "notes: owner delete" on public.notes;
create policy "notes: owner delete" on public.notes
  for delete to authenticated using (user_id = auth.uid() and public.is_app_owner());

drop policy if exists "categories: owner all" on public.categories;
create policy "categories: owner all" on public.categories
  for all to authenticated
  using (user_id = auth.uid() and public.is_app_owner())
  with check (user_id = auth.uid() and public.is_app_owner());

drop policy if exists "tags: owner all" on public.tags;
create policy "tags: owner all" on public.tags
  for all to authenticated
  using (user_id = auth.uid() and public.is_app_owner())
  with check (user_id = auth.uid() and public.is_app_owner());

drop policy if exists "attachments: owner all" on public.note_attachments;
create policy "attachments: owner all" on public.note_attachments
  for all to authenticated
  using (user_id = auth.uid() and public.is_app_owner())
  with check (user_id = auth.uid() and public.is_app_owner() and public.owns_note(note_id));

-- ── Storage policies ───────────────────────────────────────────
drop policy if exists "images: owner write" on storage.objects;
create policy "images: owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text and public.is_app_owner());

drop policy if exists "images: owner delete" on storage.objects;
create policy "images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text and public.is_app_owner());

drop policy if exists "attachments: owner write" on storage.objects;
create policy "attachments: owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = auth.uid()::text and public.is_app_owner());

drop policy if exists "attachments: owner delete" on storage.objects;
create policy "attachments: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = auth.uid()::text and public.is_app_owner());

-- ── Size limits (defence against runaway or abusive payloads) ──
do $$ begin
  alter table public.notes add constraint notes_content_size check (char_length(content_markdown) <= 500000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.notes add constraint notes_excerpt_size check (excerpt is null or char_length(excerpt) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.categories add constraint categories_description_size check (description is null or char_length(description) <= 300);
exception when duplicate_object then null; end $$;
