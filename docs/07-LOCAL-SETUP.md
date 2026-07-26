# 07 — Pokretanje lokalno

> **Status:** Oba dijela postavljena i provjerena 2026-07-25.

---

## Dio 1 — Aplikacija (radi sada)

### Preduslovi

| Alat | Verzija | Provjera |
|---|---|---|
| Node.js | 18+ (**provjereno na v22.17.0**) | `node -v` |
| npm | 9+ (provjereno na 10.9.2) | `npm -v` |

`nvm` **nije potreban**. Angular 16 zvanično navodi Node 18, ali `npm install` i
`ng build` prolaze na Node 22 bez ijedne greške.

### Pokretanje

```bash
git clone https://github.com/Filip03/Gym-App.git
cd Gym-App
git checkout XFactor
npm install
npm start
```

Aplikacija: **http://localhost:4200**

`npm install` traje ~25s i prijavljuje 64 npm ranjivosti — **ignoriši ih**.
Većina je u build alatima; `npm audit fix --force` na Angular 16 razbija build.
Zabilježeno u `03-SIGURNOST.md` → S7.

### Ostale komande

```bash
npm start                              # dev server sa hot reloadom
npm run build                          # produkcijski build → dist/gym-app/
npm run watch                          # dev build koji prati izmjene
npm test                               # Karma testovi (trenutno samo boilerplate)
npx ng build --configuration development   # brzi build bez optimizacije

npm run db:start                       # digni lokalni Supabase
npm run db:stop                        # ugasi ga (podaci ostaju)
npm run db:reset                       # vrati bazu na migracije + seed + fajlove
npm run db:storage                     # samo prenesi fajlove iz produkcije
npm run db:studio                      # otvori Studio (pregled baze)
```

> `npm run db:reset` namjerno radi i `supabase db reset` i ponovni prenos
> storage fajlova. Sam `supabase db reset` briše i storage, pa bi bez drugog
> koraka sve slike nestale.

### Napomene o dev serveru

- **Service worker je isključen u dev modu** (`enabled: !isDevMode()` u
  `app.module.ts:40`). PWA ponašanje se može testirati samo na produkcijskom
  buildu, npr. `npx http-server dist/gym-app`.
- Root ruta `/` je landing sa **4 sekunde forsiranog čekanja** prije redirecta na
  `/login`. Tokom razvoja idi direktno na `http://localhost:4200/login`.
- **Refresh na zaštićenoj ruti trenutno pokazuje „Nisi ulogovan"** — to je poznat
  bug (`02-STANJE-KODA.md` → A1), ne greška u tvom setupu. Vrati se na `/login` i
  prijavi se ponovo.

---

## Dio 2 — Lokalna baza

Postgres + Auth + Storage lokalno, sa šemom i podacima iz gita, bez zavisnosti od
cloud projekta. Obrazloženje: `05-decisions/ADR-0001-lokalni-supabase.md`.

### Preduslovi

| Alat | Napomena |
|---|---|
| Docker Desktop | mora **raditi**, ne samo biti instaliran (`docker info` mora proći) |
| Supabase CLI | **ne instalirati ručno** — u `devDependencies` je, stiže sa `npm install` |
| Slobodan prostor | ~3 GB za Docker slike Supabase stacka |

> Supabase CLI namjerno **nije** instaliran preko Homebrew-a. Kao devDependency
> ide u `package.json`, pa svi rade sa istom verzijom i niko ne mora ništa
> instalirati mimo `npm install`. (Homebrew instalacija je usput i pukla —
> traži novije Xcode Command Line Tools.)

### Pokretanje

```bash
npm install
npx supabase start     # prvi put povlači ~3 GB slika, traje nekoliko minuta
npm start
```

`supabase start` sam primjenjuje migracije iz `supabase/migrations/` i učitava
`supabase/seed.sql`. Nema ručnih koraka.

### Nalozi za prijavu

Seed sadrži prave podatke o treningu, ali **anonimizovane naloge**:

| Korisničko ime | Lozinka |
|---|---|
| `marko` | `gymapp123` |
| `Ćofi` | `gymapp123` |
| `Kaća` | `gymapp123` |

Prijava ide **korisničkim imenom**, ne emailom (emailovi su `*@local.test` i
služe samo internom Auth sloju).

Postoji i četvrti nalog (`Test`) koji **namjerno nema profil** — reprodukuje
nedosljednost iz produkcije da bi se popravka mogla testirati.

`supabase start` ispisuje lokalne podatke o pristupu:

| Servis | Adresa |
|---|---|
| API | `http://127.0.0.1:54321` |
| Studio (UI baze) | `http://127.0.0.1:54323` |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Inbucket (test emailovi) | `http://127.0.0.1:54324` |

Korisne komande:

```bash
supabase stop                  # gasi stack (podaci ostaju)
supabase stop --no-backup      # gasi i briše podatke
supabase db reset              # ponovo primijeni migracije + seed
supabase migration new naziv   # nova prazna migracija
```

### Preostali koraci postavljanja

Prati status u `04-ROADMAP.md`, Faza 0:

1. ☐ Dobiti dump baze od Filipa (šema + podaci + storage)
2. ☐ `supabase init`
3. ☐ Šema → `supabase/migrations/`
4. ☐ Podaci → `supabase/seed.sql`
5. ☐ `fileReplacements` u `angular.json` za prebacivanje local ↔ cloud
6. ☐ Provjera: login → dashboard → upis serije protiv lokalne baze

### Pravilo nakon postavljanja

> **Izmjena šeme = nova migracija. Nikad klik u Studiju.**

Studio se koristi za gledanje podataka, ne za mijenjanje strukture. Sve što se
promijeni klikom nestaje pri `db reset` i ne stiže do kolege.

---

## Rješavanje problema

| Simptom | Uzrok / rješenje |
|---|---|
| „Nisi ulogovan" nakon refresha | Poznat bug A1, ne setup. Vrati se na `/login`. |
| Port 4200 zauzet | `npm start -- --port 4300` |
| `supabase start` javlja da Docker ne radi | Pokreni Docker Desktop |
| Port 54321/54322 zauzet | Drugi Supabase projekat je pokrenut: `supabase stop` u onom direktorijumu |
| Ikone se ne prikazuju | Material Icons se učitavaju sa Google CDN-a — treba internet (`03-SIGURNOST.md` → C1 u `02-STANJE-KODA.md`) |
| Build prolazi ali se stranica ne mijenja | Service worker iz ranijeg produkcijskog builda: DevTools → Application → Service Workers → Unregister |
