-- FCM tokeni uređaja — rekonstrukcija Filipove tabele iz cloud baze.
--
-- Tabela je NASTALA direktno u cloudu (kroz Studio, 30.07.2026), uz Spring
-- Boot backend za push notifikacije: POST/DELETE /api/notifications/register-token
-- upisuje odnosno briše token, a backend iz nje čita kome šalje FCM poruke
-- (tajmer pauze, podsjetnik za neaktivnost). Frontend tabelu NIKAD ne čita —
-- sav saobraćaj ide kroz backend.
--
-- Ova migracija postoji radi pariteta lokalne šeme sa produkcijom (npm run
-- setup diže identičnu bazu). U lokalnom razvoju je tabela obično prazna, jer
-- backend na Renderu ne prima zahtjeve sa localhost porijekla (CORS).
--
-- Struktura je vjerno preslikana iz cloud REST uvida (kolone i tipovi);
-- ograničenja preko primarnog ključa su rekonstrukcija najmanje pretpostavke.

create table if not exists public.device_tokens (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null,
    token      text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.device_tokens is
    'FCM registracioni tokeni uređaja — piše ih i čita ISKLJUČIVO Spring Boot '
    'backend (register-token endpoint). Jedan korisnik može imati više redova '
    '(više uređaja/pregledača).';

create index if not exists device_tokens_user_id_idx
    on public.device_tokens (user_id);

-- Isti obrazac kao ostale tabele (vidi 20260725000002_grants.sql): platforma u
-- cloudu dodijeli grant-ove sama, lokalno se moraju ručno. ⚠️ U produkciji je
-- tabela ČITLJIVA publishable ključem (provjereno REST-om 31.07.2026) — tuđi
-- FCM tokeni su izloženi. Sigurnost je Faza 5 (docs/03-SIGURNOST.PROCITAJ.md);
-- ovdje se vjerno preslikava zatečeno stanje, ne popravlja.
grant all on table public.device_tokens to anon, authenticated, service_role;
