-- Dropset vezan za jednu working seriju.
--
-- Do sada bi se dropset morao upisati kao nova "serija" u exercice_logs, što
-- kvari set_number sekvencu, leaderboard (dropset ima namjerno nižu kilažu),
-- lični rekord i progres grafikon. Zato ide u zasebnu tabelu, sa stranim
-- ključem na working seriju kojoj pripada — exercice_logs ostaje nedirnut i
-- svi postojeći upiti (leaderboard, progres, PR, echo) rade bez izmjene.

create table if not exists public.dropset_logs (
    id              uuid primary key default gen_random_uuid(),
    exercice_log_id uuid not null,
    order_num       bigint not null default 1,
    reps            bigint not null,
    weight          double precision not null
);

comment on table public.dropset_logs is
    'Dropset(ovi) odrađeni odmah nakon jedne working serije iz exercice_logs. '
    'Namjerno IZVAN exercice_logs — ne ulazi u leaderboard/progres/PR računicu.';
comment on column public.dropset_logs.exercice_log_id is
    'Working serija kojoj dropset pripada. Jedna serija može imati više dropova '
    '(dvostruki/trostruki dropset) — nema unique ograničenja, samo order_num.';
comment on column public.dropset_logs.order_num is
    'Redoslijed dropa unutar iste working serije (1. drop, 2. drop...).';

alter table public.dropset_logs
    add constraint dropset_logs_exercice_log_id_fkey foreign key (exercice_log_id)
    references public.exercice_logs(id) on update cascade on delete cascade;

create index if not exists dropset_logs_exercice_log_idx
    on public.dropset_logs (exercice_log_id, order_num);

-- ---------------------------------------------------------------------------
-- Privilegije — isti obrazac kao exercice_logs (lični podaci, ne čitaju se
-- bez prijave).
-- ---------------------------------------------------------------------------

grant all on table public.dropset_logs to authenticated;

grant references, trigger, truncate, maintain
    on table public.dropset_logs to anon, service_role;
