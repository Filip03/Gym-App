# 04 — Roadmap

**Izvor istine o tome šta je urađeno, šta je u toku, šta slijedi.**
Ažurira se pri svakoj promjeni stanja. Oznake u zagradi (`A1`, `D4`…) upućuju na
stavke u `02-STANJE-KODA.md`.

Status: `☐ ČEKA` · `◐ U TOKU` · `☑ GOTOVO` · `✕ ODBAČENO`

---

## Faza 0 — Infrastruktura za razvoj

Cilj: da se aplikacija pokreće i razvija lokalno, bez zavisnosti od Filipovog
Supabase projekta, i da kolega jednom komandom dobije identično okruženje.

| | Zadatak | Status |
|---|---|---|
| 0.1 | Provjeriti da build radi lokalno (`npm install`, `ng build`) | ☑ GOTOVO |
| 0.2 | `CLAUDE.md` + `docs/` struktura + agenti | ☑ GOTOVO |
| 0.3 | Dump baze od Filipa (pun `pg_dump`, PostgreSQL 17.6) | ☑ GOTOVO |
| 0.4 | Supabase CLI (devDependency) + `supabase init` + Docker stack | ☑ GOTOVO |
| 0.5 | Šema kao migracije u `supabase/migrations/` (3 fajla) | ☑ GOTOVO |
| 0.6 | Seed u `supabase/seed.sql` — pravi podaci, anonimizovani nalozi | ☑ GOTOVO |
| 0.7 | Env prebacivanje local ↔ cloud (`fileReplacements`) — riješio i **A7** | ☑ GOTOVO |
| 0.8 | Prenos storage fajlova (`scripts/sync-storage.mjs`, 42 fajla) | ☑ GOTOVO |
| 0.9 | `docs/07-LOCAL-SETUP.md` sa stvarnim koracima | ☑ GOTOVO |
| 0.10 | Provjera u pregledaču: prijava → dashboard → vježbe → leaderboard | ☑ GOTOVO |

**Faza 0 je završena.** Aplikacija se razvija potpuno lokalno i ne zavisi od
Filipovog Supabase projekta. Kolega: `npm install && npx supabase start && npm start`.

---

## Faza 1 — Popravke koje odmah mijenjaju osjećaj korišćenja

Cilj: da aplikacija prestane da se ponaša pokvareno. Ništa od ovoga ne dira šemu
baze, pa može ići paralelno sa Fazom 0.

| | Zadatak | Ref | Status |
|---|---|---|---|
| 1.1 | Auth race na refreshu — sesija se čeka prije renderovanja | A1 | ☑ GOTOVO |
| 1.2 | `AuthGuard` + redirect na `/login` + `**` wildcard ruta | A2 | ☑ GOTOVO |
| 1.3 | Rang po najvećoj kilaži u periodu (ne po posljednjem rezultatu) | A3 | ☑ GOTOVO |
| 1.4 | Izbor dana treninga — odvezati trening od dana u sedmici | A4 | ☐ ČEKA |
| 1.5 | Rest day po `day_type`, ne po broju vježbi | A5 | ☐ ČEKA |
| 1.6 | Brisanje upisane serije + preračunavanje `set_number` | A6 | ☑ GOTOVO |
| 1.7 | `vercel.json` sa SPA rewrite-om | A9 | ☑ GOTOVO |
| 1.8 | Čišćenje mrtvog koda (`WorkoutPlanService`, `@supabase/ssr`) | B1, C2 | ☑ GOTOVO |
| 1.8b | Audio: iskoristiti za zvuk rekorda umjesto brisanja | C3 | ☑ GOTOVO |
| 1.9 | Favicon putanja | A8 | ☑ GOTOVO |
| 1.10 | Avatar prima video (`avatar.mp4` u `<img>`) — validacija tipa fajla | A10 | ☐ ČEKA |
| 1.11 | Nalog bez profila ruši svaki ekran — `handle_new_user()` bez zaštite | A11, S8 | ☐ ČEKA |
| 1.12 | Jedinstven birač vježbe na sva četiri mjesta (trening, rang lista, napredak) | — | ☑ GOTOVO |
| 1.13 | Ekran „Ekipa" — sedmica, feed rekorda, podijum i rang po vježbi | — | ☑ GOTOVO |
| 1.14 | Ulazne animacije (vježbe, dashboard) i klizni prekidač | — | ☑ GOTOVO |
| 1.15 | Kalendar treninga u profilu + statistika | — | ☑ GOTOVO |
| 1.16 | Prevlačenje prstom kroz dane plana | — | ☑ GOTOVO |
| 1.17 | Blog: feed sa autorom, grupisanje po periodu, novi pregled | — | ☑ GOTOVO |
| 1.18 | Ko trenira sada + bilješka uz trening | — | ☑ GOTOVO |

---

## Faza 2 — Ono zbog čega aplikacija postoji

Cilj: da podaci koji se već prikupljaju počnu nešto da znače.

| | Zadatak | Ref | Status |
|---|---|---|---|
| 2.1 | Tabela `workout_sessions` — trening kao entitet | D2 | ☑ GOTOVO |
| 2.1b | Zamjena/dodavanje/uklanjanje vježbe samo za taj dan | — | ☑ GOTOVO |
| 2.1c | „Echo" — vrijednosti prošlog treninga uz današnje | — | ☑ GOTOVO |
| 2.1d | Serije/ponavljanja po sesiji, naslijeđeno iz plana | — | ☑ GOTOVO |
| 2.2 | Istorija treninga + kalendarski pregled | D2 | ◐ U TOKU — kalendar u profilu radi, nema pregleda pojedinačnog treninga |
| 2.3 | Izvedene metrike: procijenjeni 1RM, tonaža po treningu, volumen po mišićnoj grupi | D1 | ☐ ČEKA |
| 2.4 | Detekcija PR-a + vizuelna potvrda u trenutku upisa | D3 | ☑ GOTOVO |
| 2.5 | Streak / kontinuitet treniranja | D6 | ☑ GOTOVO — niz sedmica u profilu |
| 2.6 | Tajmer pauze između serija | D4 | ☐ ČEKA |
| 2.7 | Offline upis (lokalni red čekanja + sinhronizacija) | D5 | ☑ GOTOVO |

---

## Faza 3 — Društveni sloj

Cilj: ono što je zapravo bila poenta — takmičenje i zabava u grupi.

| | Zadatak | Ref | Status |
|---|---|---|---|
| 3.1 | Feed: ko je danas trenirao, čiji je PR pao | D7 | ☑ GOTOVO — ekran „Ekipa“ |
| 3.2 | Blog kao prava objava — autor, opis, reakcije, brisanje | D8 | ☐ ČEKA |
| 3.3 | Prikaz ko prati moj plan | D10 | ☐ ČEKA |
| 3.4 | Push notifikacije (PWA infrastruktura već postoji) | D9 | ☐ ČEKA |
| 3.5 | Proširen leaderboard: po mišićnoj grupi, po tonaži, sedmični | — | ◐ U TOKU — opsezi i „Sve vrijeme“ gotovi |

---

## Faza 4 — Kvalitet koda

| | Zadatak | Ref | Status |
|---|---|---|---|
| 4.1 | Ukloniti `any` — tipovi za planove, dane, logove; `active` u model | B2 | ☐ ČEKA |
| 4.2 | Atomsko kreiranje/izmjena plana kroz RPC (jedna transakcija) | B3, B4 | ☐ ČEKA |
| 4.3 | Mapiranje tipova plana iz baze, ne iz komponente | B5 | ☐ ČEKA |
| 4.4 | Paralelizacija učitavanja (`Promise.all`) | B6 | ☐ ČEKA |
| 4.5 | Paginacija (planovi, blog) | B7 | ☐ ČEKA |
| 4.6 | Dizajn tokeni + tipografija + zaglavlje | C9 | ☑ GOTOVO |
| 4.7 | Toast/notifikacije umjesto statičnog crvenog teksta | C8 | ☐ ČEKA |
| 4.8 | Material Icons lokalno (offline podrška) | C1 | ☐ ČEKA |
| 4.9 | Testovi za servise + lint + prettier | B8 | ☐ ČEKA |

---

## Faza 5 — Sigurnost

Svjesno odgođeno. Registar rupa se vodi u `03-SIGURNOST.md` i **popunjava se
usput, ali se ne rješava usput**. Ova faza se planira tek kad se dođe do nje.

| | Zadatak | Status |
|---|---|---|
| 5.1 | Izvući i dokumentovati stvarno stanje RLS politika iz dumpa | ☐ ČEKA |
| 5.2 | RLS politike po tabelama | ☐ ČEKA |
| 5.3 | Kritične operacije u `SECURITY DEFINER` RPC | ☐ ČEKA |
| 5.4 | Storage: privatni bucketi + potpisani URL-ovi gdje treba | ☐ ČEKA |
| 5.5 | Serverska validacija (CHECK constraint-i, triggeri) | ☐ ČEKA |

---

## Odloženo / van opsega

| Stavka | Zašto |
|---|---|
| Migracija na Angular 17+ / standalone komponente | Veliki zahvat bez koristi za korisnika; razmotriti tek nakon Faze 3 |
| Zamjena template-driven formi Reactive formama | Isto — radi kako radi, nije uzrok nijednog buga |
| Preimenovanje `exercice` → `exercise` | Traži migraciju baze i dodiruje svaki fajl; kozmetika |
| Javno objavljivanje aplikacije | Nije cilj projekta |
