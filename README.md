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

## Testiranje na telefonu

Aplikacija se primarno koristi na telefonu, pa je vrijedi tako i gledati tokom
rada. Telefon i laptop moraju biti na **istoj Wi-Fi mreži**.

```bash
npm run start:lan
```

Zatim na telefonu otvori `http://<IP-LAPTOPA>:4300`.

IP laptopa:

```bash
ipconfig getifaddr en0        # macOS, Wi-Fi
hostname -I | awk '{print $1}' # Linux
```

Obični `npm start` za ovo **ne radi** — dev server se veže samo na `localhost`,
pa telefon dobije „couldn't connect to the server". `start:lan` ga veže na sve
interfejse.

Adresa Supabasea se izvodi iz onoga na čemu je stranica otvorena
(`src/environments/env.ts`), pa se ništa dodatno ne podešava — sa telefona
`192.168.x.x:4300` sam nađe bazu na `192.168.x.x:54321`.

> Service worker (PWA, rad offline, dodavanje na početni ekran) se ne aktivira
> preko `http://` na mrežnoj adresi — pregledači ga dozvoljavaju samo na
> `localhost` ili preko `https`. Za provjeru PWA ponašanja koristi Vercel
> preview link.

---

## Bez Dockera

Ako ti Docker nije opcija — samo hoćeš da povučeš, pokreneš i nešto dodaš:

```bash
npm install
npm run start:cloud     # → localhost:4300, radi protiv CLOUD baze
```

Nema Dockera, nema seed-a, nema `setup` koraka. Prijavljuješ se svojim pravim
nalogom, jer je to prava baza.

**Prije prvog pokretanja u ovom režimu** cloud baza mora dobiti nove tabele —
inače ekran treninga puca. Uputstvo (jedan copy-paste u Supabase SQL editor,
bez ikakvih alata): [`supabase/cloud/README.md`](supabase/cloud/README.md).

### Šta imati na umu

| | |
|---|---|
| Radiš nad **pravim podacima** | što obrišeš, obrisano je — nema lokalne kopije da se vratiš |
| Treba **internet** | i cloud projekat ne smije biti uspavan |
| **Izmjena šeme ide kroz migraciju** | ako nešto promijeniš klikom u Supabase Studiju, to ne stiže ni do koga i nestaje pri sljedećem `db:reset`. Napravi migraciju u `supabase/migrations/`, pa je primijeni i na cloud |

Zato je Docker režim i dalje preporučen za razvoj — ovaj je za brze izmjene.

> Nema posebne grane za ovo. Grana bi značila da se `env.ts` trajno razlikuje,
> pa bi **svaki merge imao konflikt** na tom fajlu i svaki feature bi se
> merge-ovao dvaput. Razlika je samo u tome koju bazu gađaš, a to je stvar
> konfiguracije, ne istorije.

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
