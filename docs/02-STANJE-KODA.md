# 02 — Zatečeno stanje koda

Snimak stanja na dan preuzimanja repoa (commit `bb3b239`, grana `XFactor`).
Ovo je **polazna tačka** — svaka stavka odavde se ili rješava (pa ide u
`06-CHANGELOG.md`) ili svjesno ostavlja (pa se ovdje označi kao prihvaćena).

Legenda statusa: `OTVORENO` · `U TOKU` · `RIJEŠENO` · `PRIHVAĆENO` (svjesno ne diramo)

---

## A. Bugovi koji utiču na korišćenje

### A1 — Refresh stranice izbacuje korisnika `RIJEŠENO 2026-07-25`
**Gdje:** `services/auth.service.ts:17-19` vs sve komponente u `ngOnInit`

`AuthService` konstruktor poziva `getSession()` koji je asinhron i tek u `.then()`
puni `currentUserSubject`. Komponente čitaju `getCurrentUser()` **sinhrono**, što
vraća `BehaviorSubject.value` — a to je još `null`.

```ts
// auth.service.ts — asinhrono
this.supabase.client.auth.getSession().then(({ data }) => {
  this.currentUserSubject.next(data.session?.user ?? null);
});

// dashboard.component.ts:90 — sinhrono, izvršava se prije gornjeg .then()
const user = this.authService.getCurrentUser();
if (!user) { this.errorMessage = 'Nisi ulogovan.'; ... }
```

**Efekat:** hard refresh na `/dashboard`, `/training`, `/profiles` ili `/blog`
skoro uvijek pokaže „Nisi ulogovan" iako sesija postoji u `localStorage`.
Radi samo dok korisnik navigira kroz app bez osvježavanja.

**Rješenje:** `AuthService` treba da izloži observable koji emituje tek kad je
sesija razriješena; komponente da čekaju na njega. Uz to `AuthGuard` (vidi A2).

---

### A2 — Nema route guardova `RIJEŠENO 2026-07-25`
**Gdje:** `app-routing.module.ts`

Sve rute su otvorene. Zaštita je „komponenta ispiše poruku". Nema ni redirecta na
`/login`, ni `**` wildcard rute (nepostojeća putanja → prazan ekran).

---

### A3 — Leaderboard rangira po posljednjem, ne po najboljem rezultatu `RIJEŠENO 26.07.2026`
**Gdje:** `services/leaderboard.service.ts:32-69`

```ts
.eq('exercice_id', exerciceId)
.eq('set_number', 1)              // samo prva serija
.order('date', { ascending: false });
// ...
if (latestByUser.has(row.user_id)) continue;   // uzmi najnoviji, ne najbolji
```

**Efekat:** rang lista prikazuje „prvu seriju posljednjeg treninga", a ne lični
rekord. Loš dan te obara na tabeli iako ti je PR veći. Za aplikaciju čija je
glavna svrha takmičenje — pogrešna metrika.

---

### A4 — Trening je zaključan za dan u sedmici `OTVORENO`
**Gdje:** `components/training/training.component.ts:90-96`

```ts
this.todayWorkoutDay = this.plan.workout_days.find(
  (day: any) => day.name === this.todayDayName
) ?? null;
```

Poređenje po **imenu dana**. Ako je Push zakazan za ponedjeljak a korisnik dođe
u utorak — nema šta da trenira. Nema izbora dana, pomjeranja, ni nadoknade.

---

### A5 — Rest day se detektuje po broju vježbi `OTVORENO`
**Gdje:** `components/training/training.component.ts:103`

```ts
this.isRestDay = sortedDayExercices.length === 0;
```

Ne gleda `day_type`. Dan tipa „Push" kojem nisu dodane vježbe prikazuje se kao
rest day umjesto kao greška u planu.

---

### A6 — `set_number` se računa na frontu `DJELIMIČNO RIJEŠENO 2026-07-26`
**Gdje:** `components/training/training.component.ts:208`

```ts
const nextSetNumber = ex.loggedSets.length + 1;
```

Dvije otvorene kartice ili dva uređaja → duplirani brojevi serija. Nema unique
constraint-a u bazi (vidi `01-DATABASE.md`). Uz to, **brisanje serije ne postoji
uopšte** — greška se može samo izmijeniti, ne i ukloniti.

---

### A7 — `env.prod.ts` se nikad ne koristi + ima grešku u ključu `RIJEŠENO 2026-07-25`
**Gdje:** `src/environments/env.prod.ts`, `angular.json`

`angular.json` nije imao `fileReplacements` ni u jednoj konfiguraciji, pa se uvijek
kompajlirao `env.ts`. K tome, ključ u `env.prod.ts` glasio je `b_publishable_...`
umjesto `sb_publishable_...` — nedostajalo je `s`. Fajl je bio mrtav i pogrešan.

**Riješeno** uz postavljanje lokalnog Supabasea: `fileReplacements` dodan u
produkcijsku konfiguraciju, ključ ispravljen. `env.ts` sada gađa lokalni stack,
`env.prod.ts` cloud. Provjereno na oba builda — vidi `06-CHANGELOG.md`.

### A10 — Avatar prihvata video, prikazuje se kroz `<img>` `OTVORENO`
**Gdje:** `services/profile.service.ts:78`, `components/profile/profile.component.html:10`

Ekstenzija fajla se uzima iz imena (`file.name.split('.').pop()`), a `contentType`
se šalje kao `file.type || 'image/jpeg'` — pa video prođe i kroz `accept="image/*"`
i kroz `allowed_mime_types: {image/*}` na bucketu.

**Zatečeno u pravim podacima:** korisnik `marko` ima `profile_pic_url` =
`{userId}/avatar.mp4`. Profilna se ne prikazuje jer je `<img>` tag.

### A11 — Nalog bez profila ruši svaki ekran `OTVORENO`
**Gdje:** trigger `handle_new_user()`, sve komponente

Ako u `profiles` nema reda za prijavljenog korisnika, `getProfile()` koristi
`.single()` i baca grešku, a dashboard i training ostaju na poruci o grešci.
Nema nikakvog oporavka — korisnik je zaključan van aplikacije.

**Zatečeno u pravim podacima:** 4 reda u `auth.users`, 3 u `profiles`. Uzrok je i
to što `handle_new_user()` nema `on conflict` ni `exception` blok, pa registracija
sa zauzetim korisničkim imenom (kolona je UNIQUE) napravi nalog bez profila.
Vidi `03-SIGURNOST.md` → S8.

Stanje je namjerno zadržano u `supabase/seed.sql` da bi se popravka mogla testirati.

---

### A8 — Favicon vraća 404 `RIJEŠENO 2026-07-25`
**Gdje:** `src/index.html`

```html
<link rel="icon" type="image/png" href="j.png">
```

Fajl je na `src/assets/j.png`, dakle servira se sa `/assets/j.png`.

---

### A9 — Nema SPA rewrite konfiguracije za Vercel `OTVORENO`
Nema `vercel.json`. Direktan pristup `/training` ili refresh na podruti vraća 404
osim ako je rewrite podešen ručno u Vercel dashboardu. Nije provjereno.

---

## B. Arhitektonski dug

### B1 — `WorkoutPlanService` je mrtav kod `RIJEŠENO 2026-07-25`
`services/workout-plan-service.service.ts` (68 linija) — nigdje se ne uvozi.
Duplira funkcionalnost `DashboardService`-a.

### B2 — `any` tipovi tamo gdje modeli postoje `OTVORENO`
`dashboard.component.ts`: `myPlans: any[]`, `otherPlans: any[]`, `viewedPlan: any`
`training.component.ts`: `plan: any`, `todayWorkoutDay: any`
Model `WorkoutPlan` nema polje `active` iako ga kod čita na 5 mjesta.

### B3 — N+1 upisi pri snimanju plana `OTVORENO`
`services/dashboard.service.ts:254-293` — `insertDays()` radi INSERT po danu u
petlji, plus INSERT po danu za vježbe: do 14 round-tripova. **Nema transakcije** —
ako pukne na 4. danu, u bazi ostaje polovičan plan.

### B4 — Izmjena plana briše i ponovo pravi sve dane `OTVORENO`
`services/dashboard.service.ts:205-252` (`updateFullPlan`). Namjerna odluka
(komentar u kodu to kaže), ali: ako neko prati plan, mijenja mu se pod nogama bez
ikakvog upozorenja.

### B5 — Mapiranje tipova plana hardkodirano u komponenti `OTVORENO`
`dashboard.component.ts:66-71` — `planTypeToDayTypes` mapira UPPERCASE nazive iz
baze. Preimenovanje tipa u bazi → tihi fallback na „prikaži sve tipove dana".

### B6 — Sekvencijalni `await` umjesto `Promise.all` `OTVORENO`
`dashboard.component.ts:100-103` — četiri uzastopna round-tripa koji ne zavise
jedan od drugog.

### B7 — Nema paginacije `OTVORENO`
`getOtherPlans()` vuče sve planove svih korisnika. `blogService.listMedia()` ima
Supabase default limit od 100 fajlova, bez prikaza da ih ima još.

### B8 — Nema testova `OTVORENO`
Svih 15 `.spec.ts` fajlova su generisani boilerplate (`it('should be created')`).
Nema lint-a, prettier-a, ni CI-ja.

---

## C. Sitnije

| # | Stavka | Gdje | Status |
|---|---|---|---|
| C1 | Material Icons sa Google CDN-a — blokira render, ne radi offline (protivrječi PWA) | `index.html` | `OTVORENO` |
| C2 | `@supabase/ssr` je zavisnost koja se nigdje ne koristi | `package.json:22` | `OTVORENO` |
| C3 | 6 od 8 audio fajlova se ne koristi (`orah`, `prskulja`, `bas si fina`, `obrijanica`, `zmaj u mene 25cm`, `jebala bi se...`) | `src/assets/` | `OTVORENO` |
| C4 | Miješana ekavica/ijekavica: `'Srijeda'` pored `'Nedelja'`, `'Ponedeljak'` | `shared/day-names.ts` | `OTVORENO` |
| C5 | Landing forsira 4s čekanja pri svakom otvaranju root-a | `landing.component.ts:17-23` | `OTVORENO` |
| C6 | `confirm()` native dialog za brisanje plana | `dashboard.component.ts:451` | `OTVORENO` |
| C7 | Avatar ima cache-busting (`?v=Date.now()`), leaderboard nema — ista slika, različito ponašanje | `profile.component.ts:306` vs `leaderboard.service.ts:61` | `OTVORENO` |
| C8 | Greške se prikazuju kao statični crveni tekst; nema toast-a, korisnik ih lako propusti | svuda | `OTVORENO` |
| C9 | `dashboard.component.scss` ima 857 linija; `greenyellow` ponovljen u svakoj `.scss` datoteci, bez tokena | `components/**/*.scss` | `OTVORENO` |

---

## D. Šta nedostaje kao funkcionalnost

Ovo nisu bugovi — ovo je razlika između „app bilježi podatke" i „app je koristan".

| # | Nedostaje | Zašto je bitno |
|---|---|---|
| D1 | Procijenjeni 1RM, tonaža, volumen | Nema nijedne izvedene metrike iz podataka koji već postoje |
| D2 | Istorija treninga / kalendar | Postoji samo „prethodna sesija" po jednoj vježbi |
| D3 | Detekcija ličnog rekorda (PR) | Ništa ne kaže „ovo ti je novi rekord" |
| D4 | Tajmer pauze između serija | Osnovna funkcija svake gym aplikacije |
| D5 | Offline upis | U teretani je signal loš; svaki upis trenutno pada bez interneta |
| D6 | Streak / kontinuitet | Glavni mehanizam zadržavanja u fitness aplikacijama |
| D7 | Social feed (ko je danas trenirao, čiji PR) | Poređenje postoji samo na 2 mjesta i oba su slaba |
| D8 | Blog kao prava objava (autor, opis, reakcije, brisanje) | Sad je samo `storage.list()` nad bucketom |
| D9 | Push notifikacije | PWA infrastruktura već postoji, neiskorišćena |
| D10 | Prikaz ko prati moj plan | Nema povratne informacije autoru plana |
