# GymApp

Privatna aplikacija za praćenje treninga u teretani. Angular 16 + Supabase, bez
backend servera.

---

## Pokretanje

Trebaju ti **tri** stvari, ovim redom. `npm start` sam po sebi nije dovoljan —
baza od skoro živi lokalno u Dockeru, a ne u cloudu.

### 1. Preduslovi

| Alat | Napomena |
|---|---|
| **Node.js 18+** | provjereno na v22.17.0, `nvm` nije potreban |
| **Docker Desktop** | mora biti **pokrenut**, ne samo instaliran (`docker info` mora proći) |
| ~4 GB prostora | Docker slike Supabase stacka |

Supabase CLI **ne instaliraj ručno** — stiže kroz `npm install`.

### 2. Prvi put

```bash
git clone https://github.com/Filip03/Gym-App.git
cd Gym-App
git checkout XFactor

npm install          # zavisnosti + Supabase CLI
npm run setup        # digne bazu u Dockeru i prenese slike  (~5 min prvi put)
npm start            # → http://localhost:4300
```

`npm run setup` prvi put povlači oko 3 GB Docker slika. Sljedeći put traje
nekoliko sekundi.

### 3. Svaki sljedeći put

```bash
npm run db:start     # ako Docker nije već pokrenut od ranije
npm start
```

---

## Prijava

Baza dolazi sa **pravim podacima o treningu**, ali **anonimizovanim nalozima** —
pravi emailovi i lozinke ne smiju u javni repo.

| Korisničko ime | Lozinka |
|---|---|
| `marko` | `gymapp123` |
| `Ćofi` | `gymapp123` |
| `Kaća` | `gymapp123` |

Prijava ide **korisničkim imenom**, ne emailom.

---

## Komande

```bash
npm start              # dev server              → localhost:4300
npm run build          # produkcijski build      → dist/gym-app/
npm test               # Karma testovi

npm run setup          # baza + slike, za prvi put
npm run db:start       # digni lokalni Supabase
npm run db:stop        # ugasi ga (podaci ostaju)
npm run db:reset       # vrati bazu na migracije + seed + slike
npm run db:studio      # pregled baze u pregledaču → localhost:54323
```

---

## Ako nešto ne radi

| Simptom | Uzrok |
|---|---|
| Ekran se učita ali nema podataka | Baza nije pokrenuta → `npm run db:start` |
| `supabase start` javlja grešku o Dockeru | Docker Desktop nije pokrenut |
| Port 4300 zauzet | `npm start -- --port 4301` |
| Port 54321/54322 zauzet | Drugi Supabase projekat radi → `supabase stop` u onom folderu |
| Ikone se ne prikazuju | Material Icons idu sa Google CDN-a, treba internet |
| Stranica se ne mijenja nakon builda | Stari service worker: DevTools → Application → Service Workers → Unregister |

---

## Gdje je šta

| | |
|---|---|
| `docs/` | dokumentacija projekta — **počni od `docs/README.md`** |
| `docs/06-CHANGELOG.md` | šta je mijenjano, zašto, i sa kakvim efektom |
| `docs/02-STANJE-KODA.md` | popis poznatih problema sa lokacijama u kodu |
| `docs/04-ROADMAP.md` | šta je urađeno i šta slijedi |
| `CLAUDE.md` | kontekst i pravila rada na repou |
| `supabase/migrations/` | šema baze kao SQL — **izmjena šeme = nova migracija** |
| `supabase/seed.sql` | testni podaci (generisano, ne uređivati ručno) |

---

## Napomene

- **Lokalna baza je odvojena od produkcijske.** Sve što radiš lokalno ne dira
  cloud projekat. Obrazloženje: `docs/05-decisions/ADR-0001-lokalni-supabase.md`.
- **Izmjena šeme ide isključivo kroz migraciju**, nikad klikom u Studiju —
  inače ne stiže ni do koga drugog i nestaje pri `npm run db:reset`.
- Produkcijski build (`npm run build`) automatski gađa cloud Supabase preko
  `src/environments/env.prod.ts`.
