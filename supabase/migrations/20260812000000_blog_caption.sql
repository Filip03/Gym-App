-- Opis uz blog objavu (Markov zahtjev 12.08.2026): objava do sada nije mogla
-- nositi nikakav tekst. Nullable — stare objave i objave bez teksta su uredne.
alter table public.blog_media
    add column if not exists caption text;

comment on column public.blog_media.caption is
    'Opis/tekst objave, upisan u kompozeru prije objavljivanja. NULL = bez teksta.';
