# 01 — Baza podataka

> **Status: POTVRĐENO PRODUKCIJSKIM DUMPOM** (`pg_dump`, PostgreSQL 17.6, 2026-07-25).
> Ranija verzija ovog dokumenta bila je rekonstruisana iz koda; struktura je bila
> tačna, ali su detalji ispravljeni prema dumpu.
>
> Šema živi kao migracija: `supabase/migrations/20260725000000_initial_schema.sql`.
> Podaci: `supabase/seed.sql` (anonimizovani nalozi, pravi podaci o treningu).
> Izvorni dump stoji **izvan repoa** (`Desktop/GymApp/database/dump.sql`) jer
> sadrži emailove i hasheve lozinki, a repo je javan.

## Pregled

```
profiles ──┬─< workout_plan >── plan_type
           │        │
           │        └──< workout_days >── day_type ──< day_type_muscle_group >── muscle_group
           │               │                                                          │
           │               └──< day_exercice >── exercices ──< exercice_muscle >──────┘
           │
           ├──< plan_members
           └──< exercice_logs >── exercices
```

## Tabele

### `profiles`
Javni profil korisnika. `id` je isti kao `auth.users.id`.

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid PK | = `auth.uid()` |
| `created_at` | timestamptz | |
| `username` | text | koristi se za prijavu preko RPC-a |
| `height` | numeric NULL | cm |
| `weight` | numeric NULL | kg |
| `profile_pic_url` | text NULL | **putanja** u bucketu, ne pun URL |

Popunjava se triggerom iz `auth.users.raw_user_meta_data` nakon registracije
(`username`, `weight`, `height` se šalju u `signUp` options.data).

### `plan_type`
Šifarnik tipova plana: `PPL (PUSHPULLLEGS)`, `UL (UPPERLOWER)`, `BRO SPLIT`, `FULL BODY`.

> Ova imena su **hardkodirana u frontendu** (`dashboard.component.ts:66-71`) i
> porede se u UPPERCASE. Preimenovanje u bazi tiho mijenja ponašanje UI-ja.

### `workout_plan`

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid PK | |
| `created_at` | timestamptz | |
| `created_by` | uuid FK → profiles | autor plana |
| `name` | text NULL | |
| `description` | text NULL | |
| `plan_type_id` | uuid FK → plan_type NULL | |
| `active` | boolean | ⚠️ **postoji u bazi, ne postoji u TS modelu** |

### `plan_members`
Ko prati čiji plan.

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid PK | |
| `plan_id` | uuid FK → workout_plan | |
| `profile_id` | uuid FK → profiles | **unique** — otud „max jedan praćen plan" |
| `joined_at` | timestamptz NULL | |

Unique constraint na `profile_id` je nosač logike u `training.service.ts:20-46`
(`.maybeSingle()` se oslanja na to da red može biti najviše jedan).

### `workout_days`
Dani unutar plana. Plan uvijek ima 7 dana (pon–ned), rest dan = dan bez vježbi.

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid PK | |
| `plan_id` | uuid FK → workout_plan | |
| `name` | text NULL | naziv dana, npr. `'Ponedeljak'` — **koristi se za poređenje sa današnjim danom** |
| `day_number` | int NULL | 1–7 |
| `day_type` | uuid FK → day_type NULL | ⚠️ kolona se zove `day_type`, ne `day_type_id` |

### `day_type`
Šifarnik: `PUSH`, `PULL`, `LEGS`, `UPPER`, `LOWER`, `CHEST`, `BACK`, `ARMS`, `FULLBODY`, `REST`.

### `muscle_group`
Šifarnik mišićnih grupa.

### `day_type_muscle_group`
M:N — koje mišićne grupe pripadaju kom tipu dana. Koristi se da bi se pri
kreiranju plana ponudile samo relevantne vježbe.

### `exercices`
Katalog vježbi, zajednički za sve korisnike.

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NULL | |
| `picture` | text NULL | putanja u bucketu `exercices-pictures` |
| `description` | text NULL | |

### `exercice_muscle`
M:N — vježba ↔ mišićna grupa. Vježba može pripadati većem broju grupa i tada se
u UI-ju pojavljuje u svakoj.

### `day_exercice`
Vježbe unutar jednog dana plana.

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid PK | |
| `workout_day_id` | uuid FK → workout_days | |
| `exercice_id` | uuid FK → exercices | |
| `order_num` | int NULL | redoslijed prikaza |
| `target_sets` | int NULL | planirano serija |
| `target_reps` | int NULL | planirano ponavljanja |

### `exercice_logs`
**Centralna tabela** — svaki upisani set jednog korisnika.

| Kolona | Tip | Napomena |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `exercice_id` | uuid FK → exercices | |
| `plan_id` | uuid FK → workout_plan | |
| `date` | date | lokalni datum sa fronta (`YYYY-MM-DD`) |
| `set_number` | int | redni broj serije **računat na frontu** |
| `reps` | int | |
| `weight` | numeric | kg |

Nema `workout_day_id` — log je vezan za plan i vježbu, ne za dan. Zato izmjena
plana (koja briše i ponovo pravi dane) ne ruši istoriju.

## RPC funkcije

### `get_email_by_username(p_username text) → text`
Omogućava prijavu korisničkim imenom. Vraća email iz `auth.users` za dati
username. Poziva se **prije** prijave, dakle iz neautentifikovanog konteksta.

## Storage bucketi

| Bucket | Putanja fajla | Ko upisuje |
|---|---|---|
| `profile-pictures` | `{userId}/avatar.{ext}` | `profile.service.ts` |
| `exercices-pictures` | `{exerciceId}/picture.{ext}` | `exercice.service.ts` |
| `blog` | `{timestamp}_{random}.{ext}` | `blog.service.ts` |

Svi se čitaju preko `getPublicUrl()` — dakle **javni bucketi**.

U bazi se čuva samo **putanja**, ne pun URL. Pun URL se gradi na frontu. Blog
nema tabelu uopšte — lista objava je `storage.list()` nad bucketom, bez autora,
opisa i datuma osim `created_at` fajla.

## Ključni detalji potvrđeni dumpom

Ovo su stvari koje se **nisu vidjele iz koda**, a bitne su:

| Nalaz | Zašto je bitno |
|---|---|
| `profiles.username` je **UNIQUE** | nosi `get_email_by_username()`; ujedno znači da registracija sa zauzetim imenom obara trigger i ostavlja nalog bez profila |
| `plan_members.profile_id` je **UNIQUE** | potvrđuje „max jedan praćen plan"; na to se oslanja `.maybeSingle()` |
| `day_type_muscle_group` ima **UNIQUE (day_type_id, muscle_group_id)** | sprječava duple veze |
| `exercice_logs` **nema nijedan unique** | duplirane serije su stvarno moguće (A6 nije teorijski) |
| `exercice_logs.user_id` → **`profiles(id)`** | ne `auth.users`, kako se moglo pretpostaviti |
| **Nula indeksa** van PK/unique | upiti filtriraju po `user_id, plan_id, date, exercice_id` bez podrške |
| `ON DELETE CASCADE` skoro svuda | brisanje plana briše i **svu istoriju treninga** vezanu za njega |
| `day_type_muscle_group` FK-ovi **bez** cascade | jedini izuzetak |
| `weight` je `double precision`, `height` `bigint` | visina ne prima decimale |
| `workout_plan.active` je `not null default false` | postoji u bazi, **ne postoji u TS modelu** |
| `profiles.id` ima `default auth.uid()` | zato komentar u `auth.service.ts:42` kaže da profil „ne nastaje sam" |

### Obim podataka (2026-07-25)

| Tabela | Redova |
|---|---|
| `exercice_logs` | 105 |
| `day_exercice` | 54 |
| `exercices` / `exercice_muscle` | 37 / 37 |
| `day_type_muscle_group` | 22 |
| `day_type` | 10 |
| `workout_days` | 7 |
| `muscle_group` | 6 |
| `plan_type` | 4 |
| `profiles` | 3 |
| `workout_plan` / `plan_members` | 1 / 1 |
| `auth.users` | **4** |
| `storage.objects` | 42 |

**4 naloga, 3 profila** — nalog `Test` (2026-07-20) nema red u `profiles`.
Zadržano i u seed-u, namjerno, da bi se popravka mogla testirati.

### Stvarne vrijednosti šifarnika

```
plan_type:  PPL (PushPullLegs) · UL (UpperLower) · Full Body · Bro Split
day_type:   PUSH PULL LEGS UPPER LOWER FULLBODY ARMS BACK CHEST REST
```

Hardkodirana mapa u `dashboard.component.ts:66-71` poredi ove nazive u UPPERCASE
obliku i **trenutno se poklapa** — dakle B5 je rizik, ne aktivan bug.

## Poznata ograničenja šeme

1. **Nema tabele za sesiju treninga.** Trening postoji samo kao skup redova u
   `exercice_logs` sa istim `date`. Nema trajanja, nema bilješke, nema statusa
   „završen". Zbog toga nema istorije treninga ni streak-a.
2. **Nema PR / rekorda.** Nigdje se ne bilježi lični rekord; leaderboard ga
   računa u letu i to pogrešno (vidi `02-STANJE-KODA.md`).
3. **`set_number` nije zaštićen constraint-om.** Nema unique na
   `(user_id, exercice_id, plan_id, date, set_number)` — duplikati su mogući.
4. **Blog nema relacionu reprezentaciju** — ne zna se ko je šta objavio.
5. **`workout_days.name` se koristi kao ključ za „koji je danas trening"**, što
   veže trening za dan u sedmici.

## Migracije

Cilj: šema živi kao SQL u `supabase/migrations/`, podaci u `supabase/seed.sql`,
oboje u gitu. Trenutno stanje: **još nije postavljeno** — čeka dump prave baze.
Vidi `05-decisions/ADR-0001-lokalni-supabase.md` i `07-LOCAL-SETUP.md`.
