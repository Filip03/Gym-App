-- Novosti aplikacije — spisak izmjena po deploy-u (Cloudflare Pages).
--
-- Nema admin UI-ja: redovi se dodaju ručno kroz SQL Editor pri svakom deploy-u,
-- isto kao i ostali "urednički" podaci u ovoj bazi (npr. katalog vježbi).
--
-- "Viđeno" stanje NIJE ovdje — čuva se u localStorage na frontu
-- (NewsService), po uređaju, ne po korisniku. Dovoljno za par prijatelja na
-- svom telefonu; ne treba sinhronizacija između uređaja za ovo.

create table if not exists public.news (
    id         uuid primary key default gen_random_uuid(),
    title      text not null,
    body       text not null,
    created_at timestamp with time zone not null default now()
);

comment on table public.news is
    'Spisak novosti/izmjena po update-u. Najnoviji red (po created_at) se '
    'automatski iskoči na dashboardu prvi put kad ga korisnik nije vidio.';

create index if not exists news_created_at_idx
    on public.news (created_at desc);

-- ---------------------------------------------------------------------------
-- Privilegije — javan sadržaj unutar aplikacije, isti obrazac kao exercices
-- (ne lični podaci, svi ga vide).
-- ---------------------------------------------------------------------------

grant all on table public.news to anon, authenticated, service_role;
