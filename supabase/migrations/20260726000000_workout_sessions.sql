-- Trening kao entitet.
--
-- Do sada trening nije postojao u bazi — postojali su samo redovi u
-- exercice_logs sa istim datumom. Zbog toga nije bilo moguće:
--   * zamijeniti vježbu samo za jedan dan (jedino mjesto za takav podatak bio
--     je sam plan, a plan je zajednički i trajan),
--   * imati serije/ponavljanja koji važe za taj trening a ne zauvijek,
--   * pouzdano dohvatiti "prethodni trening" za poređenje.
--
-- Rješenje: kad korisnik započne trening, dan iz plana se PREPISUJE u sesiju.
-- Od tog trenutka se mijenja sesija, ne plan.
--
-- Ref: docs/04-ROADMAP.md 2.1, docs/02-STANJE-KODA.md D1/D2/D3

-- ---------------------------------------------------------------------------
-- Sesija
-- ---------------------------------------------------------------------------

create table if not exists public.workout_sessions (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null,
    plan_id        uuid,
    workout_day_id uuid,

    date           date not null,

    -- Snimak naziva u trenutku treninga. Plan se kasnije može izmijeniti ili
    -- obrisati; istorija treninga zbog toga ne smije izgubiti smisao.
    day_label      character varying,
    day_type_name  character varying,

    started_at     timestamp with time zone not null default now(),
    finished_at    timestamp with time zone,
    note           text,

    constraint workout_sessions_user_date_unique unique (user_id, date)
);

comment on table public.workout_sessions is
    'Jedan trening. Materijalizuje se iz plana pri pokretanju i od tada živi sam.';
comment on column public.workout_sessions.plan_id is
    'Plan iz kojeg je sesija nastala. NULL = slobodan trening bez plana.';
comment on column public.workout_sessions.day_label is
    'Naziv dana prepisan iz plana (npr. "Ponedeljak"). Snimak, ne referenca.';
comment on constraint workout_sessions_user_date_unique on public.workout_sessions is
    'Jedan trening po korisniku dnevno — odgovara načinu na koji exercice_logs '
    'već koristi kolonu date. Ujedno sprječava duple sesije od dvostrukog klika.';

alter table public.workout_sessions
    add constraint workout_sessions_user_id_fkey foreign key (user_id)
    references public.profiles(id) on update cascade on delete cascade,
    add constraint workout_sessions_plan_id_fkey foreign key (plan_id)
    references public.workout_plan(id) on update cascade on delete set null,
    add constraint workout_sessions_workout_day_id_fkey foreign key (workout_day_id)
    references public.workout_days(id) on update cascade on delete set null;

-- Plan smije nestati a da sesija ostane: zato SET NULL, ne CASCADE. Ovo je
-- namjerno drugačije od ostatka šeme, gdje brisanje plana odnosi sve u lancu.

create index if not exists workout_sessions_user_date_idx
    on public.workout_sessions (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Vježbe unutar sesije
-- ---------------------------------------------------------------------------

create table if not exists public.session_exercices (
    id          uuid primary key default gen_random_uuid(),
    session_id  uuid not null,
    exercice_id uuid not null,

    order_num   bigint not null default 1,
    target_sets bigint,
    target_reps bigint,

    -- Ako je korisnik danas zamijenio vježbu, ovdje stoji ona koju je plan
    -- predviđao. Služi da se u UI-ju vidi "umjesto Bench Pressa" i da se
    -- kasnije može mjeriti koliko se plan zapravo poštuje.
    replaced_exercice_id uuid,

    -- Vježba dodana ručno, koje nema u planu za taj dan.
    is_extra    boolean not null default false
);

comment on table public.session_exercices is
    'Vježbe u jednom treningu. Prepisuju se iz day_exercice pri pokretanju, '
    'a poslije se mijenjaju slobodno bez diranja plana.';
comment on column public.session_exercices.target_sets is
    'Prijedlog naslijeđen iz plana, izmjenjiv za ovaj trening. Za razliku od '
    'day_exercice.target_sets, ovo nije trajna odluka.';

alter table public.session_exercices
    add constraint session_exercices_session_id_fkey foreign key (session_id)
    references public.workout_sessions(id) on update cascade on delete cascade,
    add constraint session_exercices_exercice_id_fkey foreign key (exercice_id)
    references public.exercices(id) on update cascade on delete cascade,
    add constraint session_exercices_replaced_fkey foreign key (replaced_exercice_id)
    references public.exercices(id) on update cascade on delete set null;

create index if not exists session_exercices_session_idx
    on public.session_exercices (session_id, order_num);

-- ---------------------------------------------------------------------------
-- Povezivanje postojećih upisa
-- ---------------------------------------------------------------------------

alter table public.exercice_logs
    add column if not exists session_id uuid;

comment on column public.exercice_logs.session_id is
    'Sesija kojoj upis pripada. NULL za upise nastale prije uvođenja sesija.';

alter table public.exercice_logs
    drop constraint if exists exercice_logs_session_id_fkey;

alter table public.exercice_logs
    add constraint exercice_logs_session_id_fkey foreign key (session_id)
    references public.workout_sessions(id) on update cascade on delete set null;

create index if not exists exercice_logs_user_exercice_date_idx
    on public.exercice_logs (user_id, exercice_id, date desc);

-- Do sada nije bilo nijednog indeksa van PK/unique, a upiti za "prethodni
-- trening" filtriraju upravo po ovoj trojci.

-- ---------------------------------------------------------------------------
-- Prenos istorije
--
-- Postojećih 105 upisa nema sesiju. Bez ovoga bi funkcija "koliko sam radio
-- prošli put" radila tek od sljedećeg treninga. Sesije se rekonstruišu iz
-- samih upisa — jedna po (korisnik, plan, datum).
-- ---------------------------------------------------------------------------

insert into public.workout_sessions (user_id, plan_id, date, started_at, finished_at)
select distinct
    l.user_id,
    l.plan_id,
    l.date,
    l.date::timestamptz,
    l.date::timestamptz
from public.exercice_logs l
where l.session_id is null
on conflict (user_id, date) do nothing;

update public.exercice_logs l
set session_id = s.id
from public.workout_sessions s
where l.session_id is null
  and s.user_id = l.user_id
  and s.date    = l.date;

-- Vježbe rekonstruisanih sesija — izvedene iz onoga što je stvarno upisano.
insert into public.session_exercices (session_id, exercice_id, order_num)
select
    l.session_id,
    l.exercice_id,
    row_number() over (partition by l.session_id order by min(l.set_number), l.exercice_id)
from public.exercice_logs l
where l.session_id is not null
group by l.session_id, l.exercice_id
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Privilegije
--
-- Isti obrazac kao exercice_logs: podaci o treningu se ne čitaju bez prijave.
-- Vidi 20260725000002_grants.sql.
-- ---------------------------------------------------------------------------

grant all on table public.workout_sessions  to authenticated;
grant all on table public.session_exercices to authenticated;

grant references, trigger, truncate, maintain
    on table public.workout_sessions to anon, service_role;
grant references, trigger, truncate, maintain
    on table public.session_exercices to anon, service_role;
