-- Jednoručne vježbe: praćenje lijeve i desne strane odvojeno.
--
-- Kod vježbi koje se rade jednom rukom (ili nogom) jedna strana je gotovo
-- uvijek jača. Do sada je postojao samo jedan upis po seriji, pa se razlika
-- između ruku nije mogla ni vidjeti ni pratiti kroz vrijeme.
--
-- `side` na exercice_logs: NULL = obje ruke zajedno (dosadašnje ponašanje,
-- svi postojeći redovi), 'L' = lijeva, 'D' = desna. Redni broj serije teče
-- ODVOJENO po strani: L1, L2... i D1, D2... — jer se strane porede svaka sa
-- svojom prošlom stranom.
--
-- `is_unilateral` na exercices: da li se vježba prati po stranama. Pali se i
-- gasi iz samog ekrana treninga; na nivou vježbe je (a ne treninga) jer ko
-- jednom odluči da lateral raise radi jednoruko, tako ga radi svaki put.

alter table public.exercices
    add column if not exists is_unilateral boolean not null default false;

comment on column public.exercices.is_unilateral is
    'Prati se svaka ruka odvojeno (L/D). Mijenja se iz ekrana treninga.';

alter table public.exercice_logs
    add column if not exists side text;

alter table public.exercice_logs
    drop constraint if exists exercice_logs_side_check;
alter table public.exercice_logs
    add constraint exercice_logs_side_check
    check (side is null or side in ('L', 'D'));

comment on column public.exercice_logs.side is
    'NULL = obje ruke zajedno; L = lijeva, D = desna. Redni broj serije teče odvojeno po strani.';
