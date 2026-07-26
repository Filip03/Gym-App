# ADR-0001 — Lokalni Supabase u Dockeru sa šemom u gitu

**Datum:** 2026-07-25
**Status:** prihvaćeno

## Kontekst

Aplikacija je preuzeta sa koleginog GitHub repoa. Svi podaci žive u **njegovom**
Supabase cloud projektu (`nsiwfwjpzyzfzxejewar`), a anon ključ je u repou pa
aplikacija radi odmah nakon `npm install`.

Ograničenja sa kojima ulazimo:

- U repou **nema SQL šeme** — ni migracija, ni dumpa, ničega. Baza postoji samo
  kao stanje u cloudu.
- Planirane izmjene (tabela za sesije treninga, PR-ovi, RLS politike) **traže
  izmjene šeme**.
- Cilj je da kolega uradi checkout grane i pokrene aplikaciju **bez ijednog
  ručnog koraka** u Supabase UI-ju i bez pristupa tuđem projektu.
- Deploy tokom razvoja se ne želi — povratna informacija mora biti trenutna.

## Razmotrene opcije

### A — Razvoj direktno na koleginom cloud projektu
Ništa se ne postavlja, radi odmah.
**Protiv:** svaka izmjena šeme odmah pogađa i njega i prave podatke. Nema
mogućnosti eksperimentisanja. Dva čovjeka na istoj bazi bez migracija =
neizbježan sukob. Testni podaci prljaju pravu bazu.

### B — Vlastiti besplatni Supabase cloud projekat kao „dev"
Odvojeno od kolege, besplatno.
**Protiv:** tabele se prave ručno kroz UI, pa šema opet ne postoji kao kod.
Kolega bi morao da ponovi isti ručni posao ili da dobije pristup mom projektu —
tačno ono što pokušavamo izbjeći. I dalje traži internet.

### C — Lokalni Supabase (Docker) sa šemom i podacima u gitu
`supabase start` diže Postgres, Auth, Storage i Studio na `localhost`. Šema živi
kao SQL migracije u `supabase/migrations/`, testni podaci u `supabase/seed.sql`.
**Protiv:** traži Docker i Supabase CLI. Početno postavljanje je posao. Šemu treba
odnekud izvući — iz dumpa prave baze ili napisati ručno.

## Odluka

**Opcija C.**

Presudni razlog je zahtjev da kolega jednom komandom dobije radno okruženje.
To je moguće **samo** ako šema baze živi u gitu kao kod. Opcije A i B ostavljaju
bazu kao stanje koje niko ne može reprodukovati — a to je upravo problem sa kojim
smo počeli (repo bez šeme).

Sporedna, ali stvarna korist: nakon ovoga projekat **prestaje da zavisi od
kolegine infrastrukture**. Ako se njegov Supabase projekat obriše, uspava ili
promijeni ključ, mi i dalje imamo kompletnu aplikaciju.

Cloud projekat ostaje kao produkcija; lokalna baza je razvojno okruženje.

## Kako se izvodi

1. Zatražiti od kolege dump: `supabase db dump` (šema) + `--data-only` (podaci)
   + sadržaj tri storage bucketa.
2. `supabase init` u repou → `supabase/` direktorijum.
3. Šemu pretvoriti u prvu migraciju, podatke u `seed.sql` (anonimizovati ako treba).
4. Dodati `fileReplacements` u `angular.json` — `env.ts` gađa lokalni Supabase,
   `env.prod.ts` cloud. (Ovo usput rješava i bug A7: `env.prod.ts` se trenutno
   uopšte ne koristi.)
5. `supabase start && npm start` → provjeriti login, dashboard, upis serije.

**Ako dump ne stigne:** šema se piše ručno iz rekonstrukcije u `01-DATABASE.md`,
a podaci se izvlače skriptom kroz PostgREST sa anon ključem koji već imamo.
Manje precizno (constraint-i i indeksi se mogu propustiti), ali ne blokira rad.

## Posljedice

**Prihvatamo:**
- Docker mora raditi da bi se radilo na projektu. Na mašini je već Docker 27.4.
- Postoje dva okruženja, pa i mogućnost da se raziđu. Migracije to drže na okupu,
  ali traže disciplinu: **izmjena šeme = migracija, nikad klik u Studiju**.
- Prvi put košta vremena prije nego što se napiše ijedna linija funkcionalnosti.

**Dobijamo:**
- Kolega: `git checkout` → `npm install` → `supabase start` → `npm start`.
- Slobodu da se šema mijenja i lomi bez posljedica po prave podatke.
- Istoriju šeme u gitu — vidi se kad je i zašto tabela dodana.
- Rad bez interneta.

**Zatvara:** razvoj „na živoj bazi". Od trenutka kad ovo proradi, cloud projekat
se dira samo pri deployu.
