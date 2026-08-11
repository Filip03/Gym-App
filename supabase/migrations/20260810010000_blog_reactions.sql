-- Reakcije na blog objave.
--
-- Grupa je mala i poenta je da SVI vide sve (Markova odluka: umjesto
-- friends/close-friends krugova — reakcije). Jedan korisnik može dati više
-- RAZLIČITIH reakcija na istu objavu, ali svaku vrstu samo jednom — ponovni
-- dodir iste vrste je skidanje (toggle na frontu, unique ovdje).

create table if not exists public.blog_reactions (
    id         uuid primary key default gen_random_uuid(),
    media_id   uuid not null,
    profile_id uuid not null,

    -- Sam emoji ('💪', '🔥'...). Paleta je na frontu (blog.component.ts);
    -- šifarnik u bazi bi za 5 vrijednosti bio ceremonija bez koristi.
    kind       text not null,

    created_at timestamp with time zone not null default now(),

    constraint blog_reactions_unique unique (media_id, profile_id, kind)
);

comment on table public.blog_reactions is
    'Reakcije na blog objave — balončići u uglu objave. Vidi ADR-0004 duh: '
    'sve javno unutar grupe.';

alter table public.blog_reactions
    add constraint blog_reactions_media_fkey foreign key (media_id)
    references public.blog_media(id) on update cascade on delete cascade,
    add constraint blog_reactions_profile_fkey foreign key (profile_id)
    references public.profiles(id) on update cascade on delete cascade;

create index if not exists blog_reactions_media_idx
    on public.blog_reactions (media_id);

-- Isti obrazac privilegija kao blog_media.
grant all on table public.blog_reactions to authenticated;
grant references, trigger, truncate, maintain
    on table public.blog_reactions to anon, service_role;
