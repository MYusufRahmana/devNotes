-- Cover image (Medium-style) for notes.
-- Run after 0001_init.sql. Safe to run more than once.

alter table public.notes
  add column if not exists cover_image text
  check (cover_image is null or char_length(cover_image) <= 2048);

-- Same trigger as 0001, with cover_image counted as a content edit.
create or replace function public.notes_before_write()
returns trigger
language plpgsql
as $$
begin
  new.title := coalesce(nullif(trim(new.title), ''), 'Untitled');

  if tg_op = 'INSERT' then
    new.slug := public.next_note_slug(coalesce(nullif(new.slug, ''), new.title), new.id);
  elsif new.slug is distinct from old.slug or coalesce(new.slug, '') = '' then
    new.slug := public.next_note_slug(coalesce(nullif(new.slug, ''), new.title), new.id);
  end if;

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

  if tg_op = 'UPDATE' then
    if (new.title, new.content_markdown, new.excerpt, new.note_type, new.category_id, new.visibility, new.status, new.slug, new.cover_image)
       is distinct from
       (old.title, old.content_markdown, old.excerpt, old.note_type, old.category_id, old.visibility, old.status, old.slug, old.cover_image) then
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
