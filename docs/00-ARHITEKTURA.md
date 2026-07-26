# 00 — Arhitektura

## Granice sistema

```
┌─────────────────────────────────────────┐
│  Browser (jedini izvršni kontekst)      │
│                                         │
│  Angular 16 SPA                         │
│    komponente  →  servisi  →  Supabase  │
│                     klijent             │
│  Service Worker (ngsw) — keš statike    │
└──────────────────┬──────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────┐
│  Supabase                               │
│    Auth        (auth.users)             │
│    PostgREST   (public.* tabele)        │
│    Storage     (3 bucketa)              │
│    RPC         (get_email_by_username)  │
└─────────────────────────────────────────┘
```

**Nema backend sloja.** Nema Express/Nest/serverless funkcija. Ne postoji mjesto
gdje se izvršava kod koji nije u browseru — osim SQL funkcija u Postgresu.

Posljedice koje treba imati na umu:

- Sva logika je vidljiva i izmjenjiva iz browsera. Jedina prava granica povjerenja
  je **RLS u Postgresu**. (Vidi `03-SIGURNOST.md`.)
- Nema mjesta za tajne. Sve u `src/environments/` je javno.
- Nema transakcija preko više upisa osim kroz Postgres RPC funkcije. Trenutno se
  višestruki upisi rade sekvencijalno iz browsera i mogu ostati polovični.

## Slojevi u kodu

### 1. Komponente (`src/app/components/`)

Drže stanje ekrana i pozivaju servise. Nema shared state managementa (nema NgRx,
nema signal store-a) — svaka komponenta učitava svoje podatke u `ngOnInit`.

Ustaljeni obrazac:

```ts
async ngOnInit() {
  const user = this.authService.getCurrentUser();
  if (!user) { this.errorMessage = 'Nisi ulogovan.'; this.loading = false; return; }
  try   { /* await servis... */ }
  catch (err: any) { this.errorMessage = err.message ?? 'Greška...'; }
  finally { this.loading = false; }
}
```

### 2. Servisi (`src/app/services/`)

Jedan servis po domenu. Svi su `providedIn: 'root'` (singletoni). Svaki prima
`SupabaseService` kroz DI i gradi upite.

Ustaljeni obrazac:

```ts
const { data, error } = await this.supabase.client.from('tabela').select('*');
if (error) throw error;
return data as Tip[];
```

Servisi **bacaju** greške; komponente ih hvataju i prikazuju. Nema interceptora,
nema globalnog error handlera, nema retry logike.

### 3. `SupabaseService`

Jedino mjesto gdje se kreira `SupabaseClient`. Sve ostalo ga dobija kroz DI.
Ovo je dobra tačka za buduće presretanje (logovanje, retry, offline queue).

## Tok autentikacije

```
Login forma (username, password)
   └→ AuthService.signInWithUsername()
        └→ RPC get_email_by_username(username) → email
             └→ supabase.auth.signInWithPassword(email, password)
                  └→ onAuthStateChange → currentUserSubject.next(user)
```

Sesija se čuva u `localStorage` (default supabase-js ponašanja) i obnavlja pri
učitavanju stranice preko `getSession()`.

> **Poznat problem:** `getSession()` je asinhron, a komponente čitaju
> `getCurrentUser()` sinhrono u `ngOnInit`. Na refresh stranice sesija još nije
> učitana → korisnik vidi „Nisi ulogovan". Detaljno u `02-STANJE-KODA.md`.

## Tok podataka: primjer „upis serije"

```
TrainingComponent.saveLog()
  └→ TrainingService.logSet({ userId, exerciceId, planId, date, setNumber, reps, weight })
       └→ INSERT INTO exercice_logs
            └→ vraćeni red se gura u ex.loggedSets (lokalno stanje)
```

Broj serije se računa **na frontu** kao `loggedSets.length + 1`. Nema
provjere u bazi — vidi poznata ograničenja.

## Rutiranje

`app-routing.module.ts` — 9 ruta, sve eager-loaded, **bez guardova**, bez lazy
loadinga, bez wildcard rute. `AppComponent` skriva logo i footer na osnovu
`router.url` poređenjem sa hardkodiranim listama.

## PWA

`@angular/service-worker` je uključen samo u produkcijskom buildu
(`enabled: !isDevMode()`). `ngsw-config.json` keširа `index.html`, JS/CSS i
`/assets/**`. **Supabase API pozivi se ne keširaju** — aplikacija offline može
da se otvori, ali ne može da učita ni upiše podatke.

Material Icons se učitavaju sa Google CDN-a (`index.html`), što znači da ikone
ne rade offline — u suprotnosti sa PWA namjerom.

## Build i deploy

| | |
|---|---|
| Build | `ng build` → `dist/gym-app/` (statika) |
| Deploy | Vercel, statički hosting |
| Env | `src/environments/env.ts` — **`env.prod.ts` se trenutno ne koristi** (nema `fileReplacements` u `angular.json`) |

Za lokalni razvoj Vercel nije potreban ni u jednom koraku.
