-- Početna šema GymApp-a.
--
-- Vjerno preslikava stanje produkcijske baze (Supabase projekat nsiwfwjpzyzfzxejewar)
-- na dan 2026-07-25, izvedeno iz punog pg_dump-a (PostgreSQL 17.6).
--
-- Namjerno je VJERNO, ne "popravljeno": lokalna baza mora da se ponaša isto kao
-- produkcija. Sve što ovdje izgleda pogrešno (a ima toga) popravlja se kasnijim
-- migracijama, da bi promjena bila vidljiva u istoriji. Vidi docs/04-ROADMAP.md.

-- ---------------------------------------------------------------------------
-- Šifarnici (bez zavisnosti)
-- ---------------------------------------------------------------------------

create table if not exists public.muscle_group (
    id   uuid primary key default gen_random_uuid(),
    name character varying
);
comment on table public.muscle_group is 'Mišićne grupe (grudi, leđa, noge...).';

create table if not exists public.day_type (
    id   uuid primary key default gen_random_uuid(),
    name character varying not null
);
comment on table public.day_type is 'Tipovi trening dana: PUSH, PULL, LEGS, REST...';

create table if not exists public.plan_type (
    id   uuid primary key default gen_random_uuid(),
    name character varying not null
);
comment on table public.plan_type is
    'Tipovi plana. PAŽNJA: nazivi se porede sa hardkodiranom mapom u '
    'dashboard.component.ts (planTypeToDayTypes), u UPPERCASE obliku. '
    'Preimenovanje ovdje tiho mijenja ponašanje UI-ja. Vidi docs/02-STANJE-KODA.md B5.';

create table if not exists public.exercices (
    id          uuid primary key default gen_random_uuid(),
    name        character varying,
    picture     text,
    description text
);
comment on table public.exercices is 'Katalog vježbi, zajednički za sve korisnike.';
comment on column public.exercices.picture is
    'Putanja unutar bucketa exercices-pictures, NE pun URL. URL se gradi na frontu.';

-- ---------------------------------------------------------------------------
-- Korisnici
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
    id              uuid primary key default auth.uid(),
    created_at      timestamp with time zone not null default now(),
    username        character varying not null unique,
    height          bigint,
    weight          double precision,
    profile_pic_url text
);
comment on table public.profiles is 'Javni profil korisnika. id = auth.users.id.';
comment on column public.profiles.username is
    'UNIQUE — na to se oslanja get_email_by_username() pri prijavi.';
comment on column public.profiles.height is 'Visina u cm. bigint, dakle bez decimala.';
comment on column public.profiles.weight is 'Težina u kg.';
comment on column public.profiles.profile_pic_url is
    'Putanja unutar bucketa profile-pictures, NE pun URL.';

-- ---------------------------------------------------------------------------
-- Planovi treninga
-- ---------------------------------------------------------------------------

create table if not exists public.workout_plan (
    id           uuid primary key default gen_random_uuid(),
    created_at   timestamp with time zone not null default now(),
    created_by   uuid,
    name         character varying,
    description  text,
    plan_type_id uuid,
    active       boolean not null default false
);
comment on table public.workout_plan is 'Plan treninga. Autor je created_by.';
comment on column public.workout_plan.active is
    'Koji od SOPSTVENIH planova se koristi kad korisnik ima više njih. '
    'Praćen tuđi plan (plan_members) ima prioritet nad ovim.';

create table if not exists public.workout_days (
    id         uuid primary key default gen_random_uuid(),
    name       character varying,
    plan_id    uuid,
    day_number bigint,
    day_type   uuid
);
comment on table public.workout_days is 'Dan unutar plana. Plan ima 7 dana (pon-ned).';
comment on column public.workout_days.name is
    'Naziv dana, npr. "Ponedeljak". PAŽNJA: training.component.ts poredi ovu '
    'vrijednost sa današnjim danom u sedmici da bi odredio šta se trenira. '
    'Vidi docs/02-STANJE-KODA.md A4.';
comment on column public.workout_days.day_type is
    'FK na day_type. Kolona se zove day_type, NE day_type_id — ne preimenovati '
    'bez izmjene svih upita u src/app/services/.';

create table if not exists public.day_exercice (
    id             uuid primary key default gen_random_uuid(),
    workout_day_id uuid,
    exercice_id    uuid,
    order_num      bigint,
    target_sets    bigint,
    target_reps    bigint
);
comment on table public.day_exercice is 'Vježbe unutar jednog dana plana, sa ciljanim serijama/ponavljanjima.';

create table if not exists public.plan_members (
    id         uuid primary key default gen_random_uuid(),
    plan_id    uuid not null,
    profile_id uuid unique,
    joined_at  timestamp with time zone default now()
);
comment on table public.plan_members is 'Ko prati čiji plan.';
comment on column public.plan_members.profile_id is
    'UNIQUE — korisnik može pratiti najviše jedan tuđi plan. Na to se oslanja '
    '.maybeSingle() u training.service.ts i dashboard.service.ts.';

-- ---------------------------------------------------------------------------
-- Veze više-na-više
-- ---------------------------------------------------------------------------

create table if not exists public.exercice_muscle (
    id              uuid primary key default gen_random_uuid(),
    exercice_id     uuid,
    muscle_group_id uuid
);
comment on table public.exercice_muscle is
    'Vježba <-> mišićna grupa. Vježba može biti u više grupa i tada se u UI-ju '
    'pojavljuje u svakoj.';

create table if not exists public.day_type_muscle_group (
    id              uuid primary key default gen_random_uuid(),
    day_type_id     uuid not null,
    muscle_group_id uuid not null,
    constraint day_type_muscle_group_unique unique (day_type_id, muscle_group_id)
);
comment on table public.day_type_muscle_group is
    'Koje mišićne grupe pripadaju kom tipu dana. Preko ove tabele se filtriraju '
    'vježbe koje se nude pri kreiranju plana.';

-- ---------------------------------------------------------------------------
-- Rezultati treninga
-- ---------------------------------------------------------------------------

create table if not exists public.exercice_logs (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null,
    exercice_id uuid not null,
    plan_id     uuid not null,
    date        date not null,
    set_number  bigint not null,
    reps        bigint not null,
    weight      double precision not null
);
comment on table public.exercice_logs is
    'Jedna upisana serija. Centralna tabela aplikacije — iz nje se računaju '
    'leaderboard i grafikoni progresa.';
comment on column public.exercice_logs.date is
    'Lokalni datum sa fronta (YYYY-MM-DD), bez vremenske zone.';
comment on column public.exercice_logs.set_number is
    'Redni broj serije. PAŽNJA: računa se NA FRONTU kao loggedSets.length + 1 i '
    'NEMA unique constraint — duplikati su mogući. Vidi docs/02-STANJE-KODA.md A6.';

-- ---------------------------------------------------------------------------
-- Strane veze
--
-- Napomena: skoro sve su ON DELETE CASCADE. Brisanje plana povlači i sve
-- exercice_logs vezane za taj plan — dakle brisanje plana briše i istoriju.
-- ---------------------------------------------------------------------------

alter table public.workout_plan
    add constraint workout_plan_created_by_fkey foreign key (created_by)
    references public.profiles(id) on update cascade on delete cascade,
    add constraint workout_plan_plan_type_id_fkey foreign key (plan_type_id)
    references public.plan_type(id) on update cascade on delete cascade;

alter table public.workout_days
    add constraint workout_days_plan_id_fkey foreign key (plan_id)
    references public.workout_plan(id) on update cascade on delete cascade,
    add constraint workout_days_day_type_fkey foreign key (day_type)
    references public.day_type(id) on update cascade on delete cascade;

alter table public.day_exercice
    add constraint day_exercice_workout_day_id_fkey foreign key (workout_day_id)
    references public.workout_days(id) on update cascade on delete cascade,
    add constraint day_exercice_exercice_id_fkey foreign key (exercice_id)
    references public.exercices(id) on update cascade on delete cascade;

alter table public.plan_members
    add constraint plan_members_plan_id_fkey foreign key (plan_id)
    references public.workout_plan(id) on update cascade on delete cascade,
    add constraint plan_members_profile_id_fkey foreign key (profile_id)
    references public.profiles(id) on update cascade on delete cascade;

alter table public.exercice_muscle
    add constraint exercice_muscle_exercice_id_fkey foreign key (exercice_id)
    references public.exercices(id) on update cascade on delete cascade,
    add constraint exercice_muscle_muscle_group_id_fkey foreign key (muscle_group_id)
    references public.muscle_group(id) on update cascade on delete cascade;

-- Jedine FK veze BEZ cascade — vjerno prema produkciji.
alter table public.day_type_muscle_group
    add constraint day_type_muscle_group_day_type_id_fkey foreign key (day_type_id)
    references public.day_type(id),
    add constraint day_type_muscle_group_muscle_group_id_fkey foreign key (muscle_group_id)
    references public.muscle_group(id);

alter table public.exercice_logs
    add constraint exercice_logs_user_id_fkey foreign key (user_id)
    references public.profiles(id) on update cascade on delete cascade,
    add constraint exercice_logs_exercice_id_fkey foreign key (exercice_id)
    references public.exercices(id) on update cascade on delete cascade,
    add constraint exercice_logs_plan_id_fkey foreign key (plan_id)
    references public.workout_plan(id) on update cascade on delete cascade;

-- Produkcija nema NIJEDAN indeks van PK/unique. Upiti u training.service.ts i
-- profile.service.ts filtriraju po (user_id, plan_id, date, exercice_id) bez
-- podrške indeksa. Pri trenutnom obimu (105 redova) nebitno; zabilježeno za Fazu 4.

-- ---------------------------------------------------------------------------
-- Funkcije
-- ---------------------------------------------------------------------------

-- Prijava korisničkim imenom: front prvo razriješi username -> email, pa tek
-- onda zove signInWithPassword. Zbog toga mora biti SECURITY DEFINER i dostupna
-- neprijavljenom korisniku.
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select au.email
  from auth.users au
  join public.profiles p on p.id = au.id
  where p.username = p_username
  limit 1;
$$;

-- Nakon registracije pravi red u profiles iz metapodataka poslatih u signUp().
-- Ovo je trigger na koji se oslanja auth.service.ts (vidi komentar u signUp()).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, username, weight, height)
  values (
      new.id,
      coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
      (new.raw_user_meta_data->>'weight')::numeric,
      (new.raw_user_meta_data->>'height')::numeric
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS — VJERNO PRESLIKANO PRODUKCIJSKO STANJE
--
-- ⚠️  OVO NIJE SIGURNA KONFIGURACIJA I NAMJERNO SE NE POPRAVLJA OVDJE.
--
-- Od 12 tabela u public, RLS je uključen na TAČNO JEDNOJ (day_type_muscle_group).
-- Sve ostale su potpuno otvorene za select/insert/update/delete svakome ko ima
-- anon ključ — a anon ključ se šalje u JS bundle-u i nije tajna.
--
-- Politike exercices_select_all i exercice_muscle_select_all postoje, ali RLS na
-- tim tabelama NIJE uključen, pa nemaju nikakav efekat. Ostavljene su da bi
-- lokalno stanje odgovaralo produkciji.
--
-- Popravka je Faza 5. Registar: docs/03-SIGURNOST.md
-- ---------------------------------------------------------------------------

alter table public.day_type_muscle_group enable row level security;

drop policy if exists day_type_muscle_group_select_all on public.day_type_muscle_group;
create policy day_type_muscle_group_select_all
    on public.day_type_muscle_group for select using (true);

-- Neaktivne politike (RLS nije uključen na ovim tabelama) — vjerno prema produkciji.
drop policy if exists exercices_select_all on public.exercices;
create policy exercices_select_all on public.exercices for select using (true);

drop policy if exists exercice_muscle_select_all on public.exercice_muscle;
create policy exercice_muscle_select_all on public.exercice_muscle for select using (true);

-- ---------------------------------------------------------------------------
-- Storage bucketi
--
-- Sva tri su JAVNA (public = true) — svaki fajl je čitljiv bez prijave, a
-- putanje su predvidive (npr. {userId}/avatar.jpg).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('profile-pictures',   'profile-pictures',   true, 26214400, '{image/*}'),
    ('exercices-pictures', 'exercices-pictures', true,  5242880, '{image/*}'),
    ('blog',               'blog',               true, 20971520, null)
on conflict (id) do nothing;
