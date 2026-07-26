-- Istorija tjelesne težine.
--
-- Do sada je profiles.weight bilo jedino ručno editovano polje — trenutna
-- vrijednost, bez istorije. Korisnik želi da upisuje težinu periodično
-- (svake 1-2 sedmice) i da vidi grafikon promjene kroz vrijeme, isto kao
-- progres za vježbe.
--
-- Rješenje: nova tabela weight_logs čuva istoriju. profiles.weight OSTAJE
-- polje koje prikazuje trenutnu vrijednost (koristi ga UI na drugim mjestima),
-- ali se od sada ažurira iz aplikacije na najnoviji upis iz weight_logs
-- (vidi ProfileService.logWeight()), umjesto da se mijenja samo ručno kroz
-- formu za izmjenu profila.

create table if not exists public.weight_logs (
    id         uuid primary key default gen_random_uuid(),
    profile_id uuid not null,
    date       date not null,
    weight     double precision not null,
    created_at timestamp with time zone not null default now(),

    constraint weight_logs_profile_date_unique unique (profile_id, date)
);

comment on table public.weight_logs is
    'Istorija tjelesne težine korisnika, upisana ručno periodično. '
    'profiles.weight uvijek drži vrijednost POSLJEDNJEG (po datumu) upisa odavde.';
comment on constraint weight_logs_profile_date_unique on public.weight_logs is
    'Jedan upis po danu — ponovni upis istog dana ažurira postojeći red '
    '(upsert iz ProfileService.logWeight()), ne pravi duplikat.';

alter table public.weight_logs
    add constraint weight_logs_profile_id_fkey foreign key (profile_id)
    references public.profiles(id) on update cascade on delete cascade;

create index if not exists weight_logs_profile_date_idx
    on public.weight_logs (profile_id, date desc);

-- ---------------------------------------------------------------------------
-- Privilegije — isti obrazac kao exercice_logs/workout_sessions: lični podaci,
-- ne čitaju se bez prijave. Vidi 20260725000002_grants.sql.
-- ---------------------------------------------------------------------------

grant all on table public.weight_logs to authenticated;

grant references, trigger, truncate, maintain
    on table public.weight_logs to anon, service_role;
