-- Privatni planovi.
--
-- Plan je do sada bio vidljiv svima u grupi i svako ga je mogao zapratiti.
-- Vlasnik sada može označiti plan kao privatan: takav plan se drugima ne
-- pojavljuje u listi „Planovi ostalih korisnika" niti ga mogu zapratiti.
--
-- Namjerno NEMA čišćenja plan_members: ko je plan zapratio dok je bio javan,
-- nastavlja da trenira po njemu — čovjek se ne izbacuje iz treninga zato što
-- je vlasnik naknadno povukao plan iz izloga. Privatnost skriva plan iz
-- IZLOGA, ne prekida postojeće odnose.
--
-- Filtriranje je u upitu na frontu, ne kroz RLS — sigurnost je svjesno
-- zasebna faza (docs/03-SIGURNOST.PROCITAJ.md, CLAUDE.md pravilo 5).

alter table public.workout_plan
    add column if not exists is_private boolean not null default false;

comment on column public.workout_plan.is_private is
    'Privatan plan: drugima nevidljiv u listi i nemoguć za zapratiti. '
    'Postojeći pratioci ostaju. Default javno — postojeće ponašanje.';
