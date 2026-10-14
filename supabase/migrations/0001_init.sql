-- DevNotes — Personal Technical Knowledge Base
-- Schema, triggers, search, RLS and storage policies.
-- Run in Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.note_type as enum ('ARTICLE', 'GUIDE', 'TROUBLESHOOTING', 'CHEATSHEET', 'SNIPPET');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.note_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.note_visibility as enum ('PRIVATE', 'PUBLIC');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'untitled'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  slug text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled' check (char_length(title) <= 200),
  slug text not null,
  excerpt text,
  content_markdown text not null default '',
  note_type public.note_type not null default 'SNIPPET',
  category_id uuid references public.categories (id) on delete set null,
  status public.note_status not null default 'DRAFT',
  visibility public.note_visibility not null default 'PRIVATE',
  is_pinned boolean not null default false,
  is_favorite boolean not null default false,
  reading_time integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz
);

create unique index if not exists notes_slug_key on public.notes (slug);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_category_idx on public.notes (category_id);
create index if not exists notes_public_idx on public.notes (visibility, status);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  slug text not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create index if not exists note_tags_tag_idx on public.note_tags (tag_id);

create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists note_attachments_note_idx on public.note_attachments (note_id);

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────
drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Finds a free slug across all users (security definer so RLS does not hide conflicts).
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
  while exists (select 1 from public.notes where slug = candidate and id <> current_id) loop
    n := n + 1;
    candidate := root || '-' || n;
  end loop;
  return candidate;
end;
$$;

revoke all on function public.next_note_slug(text, uuid) from public, anon;
grant execute on function public.next_note_slug(text, uuid) to authenticated;

create or replace function public.notes_before_write()
returns trigger
language plpgsql
as $$
begin
  new.title := coalesce(nullif(trim(new.title), ''), 'Untitled');

  -- Slug: normalise and keep it unique.
  if tg_op = 'INSERT' then
    new.slug := public.next_note_slug(coalesce(nullif(new.slug, ''), new.title), new.id);
  elsif new.slug is distinct from old.slug or coalesce(new.slug, '') = '' then
    new.slug := public.next_note_slug(coalesce(nullif(new.slug, ''), new.title), new.id);
  end if;

  -- Status timestamps.
  if new.status = 'PUBLISHED' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status <> 'ARCHIVED' then
    new.archived_at := null;
  elsif tg_op = 'INSERT' then
    new.archived_at := now();
  elsif old.status is distinct from 'ARCHIVED' then
    new.archived_at := now();
  end if;

  -- Only real content edits move updated_at, so pin/favorite toggles
  -- do not pollute "Recently updated".
  if tg_op = 'UPDATE' then
    if (new.title, new.content_markdown, new.excerpt, new.note_type, new.category_id, new.visibility, new.status, new.slug)
       is distinct from
       (old.title, old.content_markdown, old.excerpt, old.note_type, old.category_id, old.visibility, old.status, old.slug) then
      new.updated_at := now();
    else
      new.updated_at := old.updated_at;
    end if;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists notes_before_write on public.notes;
create trigger notes_before_write
  before insert or update on public.notes
  for each row execute function public.notes_before_write();

-- ─────────────────────────────────────────────────────────────
-- RPC: replace a note's tags atomically
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_note_tags(p_note_id uuid, p_tags text[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_tag_id uuid;
begin
  if v_uid is null or not exists (select 1 from notes where id = p_note_id and user_id = v_uid) then
    raise exception 'Note not found' using errcode = 'P0002';
  end if;

  delete from note_tags where note_id = p_note_id;

  foreach v_name in array coalesce(p_tags, '{}'::text[]) loop
    v_name := lower(trim(v_name));
    continue when v_name = '' or char_length(v_name) > 40;

    insert into tags (user_id, name, slug)
    values (v_uid, v_name, slugify(v_name))
    on conflict (user_id, slug) do update set name = tags.name
    returning id into v_tag_id;

    insert into note_tags (note_id, tag_id) values (p_note_id, v_tag_id)
    on conflict do nothing;
  end loop;

  -- Drop tags that are no longer used anywhere.
  delete from tags t
  where t.user_id = v_uid
    and not exists (select 1 from note_tags nt where nt.tag_id = t.id);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RPC: ranked search (title → tag → category → content)
-- Every term must match at least one field. Uses strpos so that
-- code-like tokens (optimize:clear, --prune, 5432) match literally.
-- ─────────────────────────────────────────────────────────────
create or replace function public.search_notes(q text, include_archived boolean default false, max_results integer default 30)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  note_type public.note_type,
  status public.note_status,
  visibility public.note_visibility,
  is_pinned boolean,
  is_favorite boolean,
  category_id uuid,
  reading_time integer,
  created_at timestamptz,
  updated_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  tags text[],
  snippet text,
  score real
)
language sql
stable
security invoker
set search_path = public
as $$
  with terms as (
    select distinct lower(t) as term
    from unnest(regexp_split_to_array(trim(coalesce(q, '')), '\s+')) as t
    where length(t) > 0
    limit 8
  ),
  term_count as (select count(*) as n from terms),
  base as (
    select
      n.*,
      lower(n.title) as l_title,
      lower(n.content_markdown) as l_content,
      lower(coalesce(n.excerpt, '')) as l_excerpt,
      lower(coalesce(c.name, '')) as l_category,
      coalesce(
        (select array_agg(tg.name order by tg.name)
         from note_tags nt join tags tg on tg.id = nt.tag_id
         where nt.note_id = n.id),
        '{}'::text[]
      ) as tag_names
    from notes n
    left join categories c on c.id = n.category_id
    where (include_archived or n.status <> 'ARCHIVED')
      and (auth.uid() is null or n.user_id = auth.uid())
  ),
  scored as (
    select
      b.*,
      (
        select count(*)
        from terms t
        where strpos(b.l_title, t.term) > 0
           or strpos(b.l_category, t.term) > 0
           or strpos(b.l_excerpt, t.term) > 0
           or strpos(b.l_content, t.term) > 0
           or exists (select 1 from unnest(b.tag_names) tn where strpos(tn, t.term) > 0)
      ) as matched,
      (
        select coalesce(sum(
          case
            when b.l_title = t.term then 120
            when b.l_title like t.term || '%' then 100
            when strpos(b.l_title, ' ' || t.term) > 0 then 90
            when strpos(b.l_title, t.term) > 0 then 75
            else 0
          end
          + case
              when t.term = any (b.tag_names) then 60
              when exists (select 1 from unnest(b.tag_names) tn where strpos(tn, t.term) > 0) then 40
              else 0
            end
          + case
              when b.l_category = t.term then 40
              when strpos(b.l_category, t.term) > 0 then 25
              else 0
            end
          + case when strpos(b.l_excerpt, t.term) > 0 then 15 else 0 end
          + case when strpos(b.l_content, t.term) > 0 then 10 else 0 end
        ), 0)
        from terms t
      ) as term_score,
      (select min(nullif(strpos(b.l_content, t.term), 0)) from terms t) as first_pos
    from base b
  )
  select
    s.id, s.title, s.slug, s.excerpt, s.note_type, s.status, s.visibility,
    s.is_pinned, s.is_favorite, s.category_id, s.reading_time,
    s.created_at, s.updated_at, s.published_at, s.archived_at,
    s.tag_names as tags,
    case
      when s.first_pos is null then null
      when s.first_pos <= 60 then regexp_replace(substr(s.content_markdown, 1, 180), '\s+', ' ', 'g')
      -- Start on a word boundary instead of mid-word.
      else '…' || regexp_replace(
        regexp_replace(substr(s.content_markdown, s.first_pos - 60, 180), '^\S*\s+', ''),
        '\s+', ' ', 'g'
      )
    end as snippet,
    (
      s.term_score
      + case when strpos(s.l_title, lower(trim(q))) > 0 and (select n from term_count) > 1 then 50 else 0 end
      + case when s.is_pinned then 6 else 0 end
      + case when s.is_favorite then 4 else 0 end
      + greatest(0, 5 - extract(epoch from (now() - s.updated_at)) / 86400 / 30)
      - case when s.status = 'ARCHIVED' then 30 else 0 end
    )::real as score
  from scored s
  where s.matched = (select n from term_count)
    and (select n from term_count) > 0
  order by score desc, s.updated_at desc
  limit greatest(1, least(max_results, 100));
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- Cross-table checks go through small SECURITY DEFINER helpers so
-- policies never evaluate each other recursively (note_tags ↔ tags).
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_public_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from notes where id = p_note_id and visibility = 'PUBLIC' and status = 'PUBLISHED'
  );
$$;

create or replace function public.owns_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from notes where id = p_note_id and user_id = auth.uid());
$$;

create or replace function public.owns_tag(p_tag_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from tags where id = p_tag_id and user_id = auth.uid());
$$;

create or replace function public.is_public_tag(p_tag_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from note_tags nt join notes n on n.id = nt.note_id
    where nt.tag_id = p_tag_id and n.visibility = 'PUBLIC' and n.status = 'PUBLISHED'
  );
$$;

create or replace function public.is_public_category(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from notes
    where category_id = p_category_id and visibility = 'PUBLIC' and status = 'PUBLISHED'
  );
$$;

create or replace function public.is_public_attachment(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from note_attachments a join notes n on n.id = a.note_id
    where a.storage_path = p_storage_path and n.visibility = 'PUBLIC' and n.status = 'PUBLISHED'
  );
$$;

alter table public.categories enable row level security;
alter table public.notes enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;
alter table public.note_attachments enable row level security;

-- notes
drop policy if exists "notes: public read published" on public.notes;
create policy "notes: public read published" on public.notes
  for select using (visibility = 'PUBLIC' and status = 'PUBLISHED');

drop policy if exists "notes: owner read" on public.notes;
create policy "notes: owner read" on public.notes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notes: owner insert" on public.notes;
create policy "notes: owner insert" on public.notes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "notes: owner update" on public.notes;
create policy "notes: owner update" on public.notes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notes: owner delete" on public.notes;
create policy "notes: owner delete" on public.notes
  for delete to authenticated using (user_id = auth.uid());

-- categories
drop policy if exists "categories: owner all" on public.categories;
create policy "categories: owner all" on public.categories
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "categories: public read used" on public.categories;
create policy "categories: public read used" on public.categories
  for select using (public.is_public_category(id));

-- tags
drop policy if exists "tags: owner all" on public.tags;
create policy "tags: owner all" on public.tags
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "tags: public read used" on public.tags;
create policy "tags: public read used" on public.tags
  for select using (public.is_public_tag(id));

-- note_tags
drop policy if exists "note_tags: read via note" on public.note_tags;
create policy "note_tags: read via note" on public.note_tags
  for select using (public.owns_note(note_id) or public.is_public_note(note_id));

drop policy if exists "note_tags: owner write" on public.note_tags;
drop policy if exists "note_tags: owner insert" on public.note_tags;
create policy "note_tags: owner insert" on public.note_tags
  for insert to authenticated
  with check (public.owns_note(note_id) and public.owns_tag(tag_id));

drop policy if exists "note_tags: owner delete" on public.note_tags;
create policy "note_tags: owner delete" on public.note_tags
  for delete to authenticated using (public.owns_note(note_id));

-- note_attachments
drop policy if exists "attachments: owner all" on public.note_attachments;
create policy "attachments: owner all" on public.note_attachments
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_note(note_id));

drop policy if exists "attachments: public read" on public.note_attachments;
create policy "attachments: public read" on public.note_attachments
  for select using (public.is_public_note(note_id));

grant execute on function public.search_notes(text, boolean, integer) to anon, authenticated;
grant execute on function public.set_note_tags(uuid, text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage
--   note-images       public bucket   (paths: <uid>/<note_id>/<file>)
--   note-attachments  private bucket  (served via short-lived signed URLs)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-images', 'note-images', true, 10485760,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-attachments', 'note-attachments', false, 26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/json',
    'text/csv',
    'application/zip',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

drop policy if exists "images: owner write" on storage.objects;
create policy "images: owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images: owner delete" on storage.objects;
create policy "images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images: owner read" on storage.objects;
create policy "images: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: owner write" on storage.objects;
create policy "attachments: owner write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: owner delete" on storage.objects;
create policy "attachments: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments: owner or public note read" on storage.objects;
create policy "attachments: owner or public note read" on storage.objects
  for select
  using (
    bucket_id = 'note-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_public_attachment(name)
    )
  );
