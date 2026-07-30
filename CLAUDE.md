# CLAUDE.md — GymApp

Kontekst za Claude Code i za svakog ko prvi put otvara ovaj repo.
Jezik dokumentacije i koda (komentari, UI stringovi): **srpski/bosanski, latinica**.

---

## 1. Šta je ovo

Privatna fitness aplikacija za praćenje treninga u teretani, namijenjena maloj
zatvorenoj grupi korisnika (nekoliko prijatelja). Poenta nije javni proizvod nego:

1. bilježenje serija/ponavljanja/kilaže po treningu,
2. međusobno poređenje i takmičenje,
3. da bude zabavna za tu grupu.

Aplikacija **nije javna** i ne planira se javno objavljivanje.

---

## 2. Stack

| Sloj | Tehnologija |
|---|---|
| Frontend | Angular **16.2** — NgModule stil (`app.module.ts`), ne standalone API |
| Jezik | TypeScript 5.1 |
| Stilovi | SCSS po komponenti, bez UI biblioteke |
| Forme | Template-driven (`[(ngModel)]`, `#form="ngForm"`) — **ne** Reactive Forms |
| Podaci | `@supabase/supabase-js` v2, pozivan **direktno iz browsera** |
| Auth | Supabase Auth (email + password, login preko username-a via RPC) |
| Fajlovi | Supabase Storage (3 bucketa) |
| PWA | `@angular/service-worker` + `ngsw-config.json` + `manifest.webmanifest` |
| Hosting | Vercel (statički build), Supabase (baza + auth + storage) |

**Nema backend servera.** Nema Node/Express/API sloja. Sve što aplikacija radi,
radi iz browsera prema Supabaseu. Ne treba Railway ni bilo koja treća platforma.

---

## 3. Struktura repoa

```
src/
  app/
    app.module.ts               # registracija svih komponenti (NgModule)
    app-routing.module.ts       # rute — trenutno BEZ guardova
    app.component.*             # shell: logo + <router-outlet> + footer
    components/
      landing/                  # splash ekran, auto-redirect na /login
      login/  register/         # standalone komponente (izuzetak od NgModule stila)
      dashboard/                # planovi: pregled, kreiranje, izmjena, follow
      training/                 # današnji trening, upis serija
      exercices/                # katalog vježbi po mišićnim grupama
      leaderboard/              # rang lista po vježbi
      profile/                  # profil + SVG grafikon progresa
      blog/                     # galerija slika/videa iz storage bucketa
      footer/                   # donja navigacija (ikone)
    services/                   # jedan servis po domenu, svi pozivaju SupabaseService
      supabase_service.ts       # jedini kreator SupabaseClient-a
      auth.service.ts
      dashboard.service.ts      # planovi, dani, vježbe u planu, follow/activate
      training.service.ts       # trening sesija + exercice_logs
      exercice.service.ts       # katalog vježbi + mišićne grupe
      leaderboard.service.ts
      profile.service.ts
      blog.service.ts
      workout-plan-service.service.ts   # MRTAV KOD — nigdje se ne koristi
    models/models.ts            # svi TypeScript interfejsi
    shared/day-names.ts         # DAY_NAMES konstanta (pon–ned)
  environments/
    env.ts                      # jedini env koji se stvarno koristi
    env.prod.ts                 # MRTAV — nema fileReplacements u angular.json
  assets/                       # slike, ikone, audio memovi
docs/                           # dokumentacija projekta (vidi docs/README.md)
```

---

## 4. Šema baze (rekonstruisana iz koda — SQL nije u repou)

```
profiles          id, created_at, username, height, weight, profile_pic_url
plan_type         id, name                          # PPL, UL, BRO SPLIT, FULL BODY
workout_plan      id, created_at, created_by→profiles, name, description,
                  plan_type_id→plan_type, active
plan_members      id, plan_id, profile_id, joined_at    # unique na profile_id
workout_days      id, plan_id, name, day_number, day_type→day_type
day_type          id, name                          # PUSH, PULL, LEGS, REST...
muscle_group      id, name
day_type_muscle_group   day_type_id, muscle_group_id
exercices         id, name, picture, description
exercice_muscle   exercice_id, muscle_group_id      # M:N vježba ↔ mišićna grupa
day_exercice      id, workout_day_id, exercice_id, order_num, target_sets, target_reps
exercice_logs     id, user_id, exercice_id, plan_id, date, set_number, reps, weight
```

**Storage bucketi:** `profile-pictures`, `exercices-pictures`, `blog`
**RPC:** `get_email_by_username(p_username)` → omogućava prijavu preko korisničkog imena
**Trigger:** kreira red u `profiles` iz `auth.users` metadata nakon registracije

Detaljno u `docs/01-DATABASE.md`.

---

## 5. Ključne konvencije koda

Poštuj postojeći stil — cilj je da kolega prepozna svoj kod.

- **Servisi:** `@Injectable({ providedIn: 'root' })`, sve metode `async`, uvijek
  `const { data, error } = await ...` pa `if (error) throw error;`
- **Komponente:** hvataju grešku u `try/catch`, upisuju je u `errorMessage` polje
  i prikazuju kao `<p class="error">`. Nema globalnog error handlera.
- **Nazivi:** engleski za kod (`getPlanForUser`), **srpski/bosanski za UI stringove**
  (`'Nisi ulogovan.'`, `'Sačuvaj plan'`) i za komentare.
- **Tipografija naziva:** `exercice` (ne `exercise`) — namjerno zadržan postojeći
  pravopis kroz cijeli kod i bazu. Ne ispravljati bez migracije.
- **Modali:** `*ngIf` na `.modal-overlay`, klik na overlay zatvara,
  `(click)="$event.stopPropagation()"` na `.modal-card`.
- **Ikone:** Material Icons preko `<i class="material-icons">naziv</i>`.

### Animacije — kućno pravilo (obavezno)

Sve promjene stanja UI elemenata animiraju se „tečnim/mastilo" jezikom pokreta:
squash & stretch + ink-bloom kap iz tačke interakcije + sadržaj koji izranja
talasom. **Svako stanje i svaki prelaz mora imati pokret** — uključujući
povratne i timeout prelaze; nijedan trenutni preskok. Sve se gasi uz
`prefers-reduced-motion`. Detaljan recept, zamke i referentne implementacije:
skill `tecne-animacije` (`.claude/skills/tecne-animacije/SKILL.md`).

### Dizajn sistem (de facto, nije formalizovan)

- Akcenat: `greenyellow` (CSS ključna riječ, hardkodirana u svakoj `.scss` datoteci)
- Kartice: `rgba(255,255,255,0.05)` + `backdrop-filter: blur(12px)` + `border-radius: 20px`
- Greška: `#ff6b6b`
- Tekst: bijeli na tamnoj pozadinskoj slici (`src/assets/background.jpg`)

---

## 6. Poznata stanja koda (na dan preuzimanja repoa)

Ovo je zatečeno stanje, **ne** stil koji treba oponašati:

- Nema route guardova — sve rute su otvorene
- Auth race na refreshu: `getCurrentUser()` se čita sinhrono prije nego što
  `getSession()` napuni `BehaviorSubject`
- `any` tipovi na mjestima gdje postoje modeli (`myPlans: any[]`, `viewedPlan: any`)
- Model `WorkoutPlan` nema polje `active` iako ga kod čita
- Nema testova — svih 15 `.spec.ts` su generisani boilerplate
- Nema lint/prettier/CI konfiguracije

Kompletan popis sa lokacijama: `docs/02-STANJE-KODA.md`.

---

## 7. Kako raditi lokalno

```bash
npm install
supabase start     # lokalni Postgres + Auth + Storage u Dockeru
npm start          # → http://localhost:4200
```

Baza je verzionisana u `supabase/migrations/` i `supabase/seed.sql` — razvoj **ne
zavisi** od cloud Supabase projekta. Detaljno: `docs/07-LOCAL-SETUP.md`.

**Provjereno:** Node v22.17.0 + npm 10.9.2 rade sa Angular 16 (build prolazi),
iako Angular 16 zvanično navodi Node 18. Nije potreban nvm.

---

## 8. Pravila rada na ovom repou

> Ova sekcija je obavezujuća za Claude Code.

1. **Svaka izmjena se dokumentuje.** Nakon svake završene promjene upisati unos u
   `docs/06-CHANGELOG.md` — šta je promijenjeno, gdje (`fajl:linija`), zašto, i
   kakav je efekat. Cilj je da kolega može pročitati changelog i razumjeti kod
   bez čitanja diffa.
2. **Arhitektonske odluke idu u ADR.** Sve što mijenja strukturu (novi sloj, nova
   tabela, promjena toka podataka) dobija fajl u `docs/05-decisions/`.
3. **Roadmap se održava.** `docs/04-ROADMAP.md` je izvor istine o tome šta je
   urađeno, šta je u toku, šta slijedi. Ažurirati status pri svakoj promjeni.
4. **Ne mijenjaj postojeći stil bez razloga.** Ovo je kolegin kod; refaktor je
   dozvoljen kad rješava konkretan problem, ne radi estetike.
5. **Ne diraj sigurnost dok se ne dođe na red.** Poznate su rupe (RLS, javni
   ključevi, otvorene rute). Svjesna odluka: aplikacija je privatna, sigurnost je
   zasebna faza. Ne „usput popravljati" — evidentirati u `docs/03-SIGURNOST.md`.
6. **Nema deploya bez izričitog traženja.** Razvoj je lokalan.
7. **UI stringovi na srpskom/bosanskom.** Bez izuzetka.

---

## 9. Git

- Remote: `https://github.com/Filip03/Gym-App.git` (vlasnik: kolega Filip)
- Grane: `main`, `blog`, `XFactor` (radna grana)
- Radi na `XFactor` ili feature granama; ne push-uj na `main` bez dogovora
