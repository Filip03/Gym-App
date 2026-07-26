# 06 — Changelog

Hronološki zapis svake izmjene, **namijenjen kolegi koji je pisao originalni kod**.
Nije zamjena za `git log` — cilj je da se pročita *zašto* i *kakav je efekat*, bez
čitanja diffa.

## Format unosa

```markdown
## [YYYY-MM-DD] Naslov izmjene
**Tip:** popravka | funkcionalnost | refaktor | infrastruktura | dokumentacija
**Ref:** oznaka iz 02-STANJE-KODA.md ili 04-ROADMAP.md (ako postoji)

**Problem:** šta nije valjalo i kako se manifestovalo
**Rješenje:** šta je urađeno, u jednom pasusu
**Dodirnuti fajlovi:** `putanja:linija` — šta se promijenilo u svakom
**Efekat:** šta korisnik/programer sada vidi drugačije
**Napomene:** kompromisi, poznata ograničenja, šta ostaje za kasnije
```

---

## [2026-07-25] Postavljena dokumentacija projekta
**Tip:** dokumentacija
**Ref:** Roadmap 0.2

**Problem:** Repo je preuzet bez ikakve dokumentacije — samo generisani Angular
CLI README. Šema baze nije postojala nigdje u kodu, arhitektura se morala čitati
iz upita u servisima, a nije bilo mjesta gdje bi se bilježilo šta se mijenja.
Bez toga kolega ne bi mogao da prati izmjene niti da razumije odluke.

**Rješenje:** Napravljen `CLAUDE.md` kao ulazna tačka (stack, struktura, konvencije,
obavezujuća pravila rada) i `docs/` direktorijum sa devet dokumenata. Cijeli
codebase (~7.000 linija, 89 fajlova) je pročitan i analiziran; šema baze je
rekonstruisana iz Supabase upita u servisima jer SQL nije postojao u repou.

**Dodirnuti fajlovi:**
- `CLAUDE.md` — novo: stack, mapa repoa, rekonstruisana šema, konvencije koda,
  poznata stanja, pravila rada (sekcija 8 je obavezujuća)
- `docs/README.md` — novo: indeks i preporučeni redoslijed čitanja
- `docs/00-ARHITEKTURA.md` — novo: granice sistema, slojevi, tok autentikacije,
  tok podataka na primjeru upisa serije
- `docs/01-DATABASE.md` — novo: 12 tabela, relacije, RPC, storage bucketi,
  ograničenja šeme. **Označeno kao rekonstruisano, nije potvrđeno dumpom**
- `docs/02-STANJE-KODA.md` — novo: 9 bugova (A1–A9), 8 stavki duga (B1–B8),
  9 sitnijih (C1–C9), 10 nedostajućih funkcionalnosti (D1–D10), svaka sa
  `fajl:linija` lokacijom
- `docs/03-SIGURNOST.md` — novo: registar od 7 stavki, sa jasnim pravilom da se
  sigurnost ne popravlja usput
- `docs/04-ROADMAP.md` — novo: 6 faza sa statusom po zadatku
- `docs/05-decisions/` — novo: ADR direktorijum + prva odluka
- `docs/06-CHANGELOG.md` — ovaj fajl
- `docs/07-LOCAL-SETUP.md` — novo: uputstvo za pokretanje
- `docs/08-KONVENCIJE.md` — novo: kodni standardi izvedeni iz postojećeg koda

**Efekat:** Svaka naredna izmjena ima gdje da se zapiše i sa čim da se uporedi.
Kolega može da otvori `docs/06-CHANGELOG.md` i vidi šta se dešavalo, ili
`docs/02-STANJE-KODA.md` da vidi šta je bilo zatečeno.

**Napomene:** `01-DATABASE.md` je najslabija tačka dok ne stigne dump prave baze —
constraint-i, indeksi, default vrijednosti i RLS politike su nepoznati.

---

## [2026-07-26] Popravke nakon prve upotrebe: pozadina, meni, semantika rekorda
**Tip:** popravka
**Ref:** prijave vlasnika projekta nakon testiranja

**Problem:** Pet stvari uočenih u stvarnoj upotrebi.

1. **Pozadina se „zumirala" na svaki klik.** Slika je bila na `<body>` sa
   `background-size: cover`, pa se ponovo skalirala pri svakoj promjeni visine
   stranice — a to se dešava kad god se otvori meni ili obrazac.
2. **Meni vježbe je iskakao bez prelaza.** `*ngIf` uklanja element iz DOM-a, pa
   se visina mijenja skokom.
3. **Plamen rekorda je stajao uz SVAKU seriju.** Trening 70–72–74 kg davao je
   tri „rekorda", jer se svaka serija poredila sa najboljim ikad, uključujući i
   serije upisane isti dan.
4. **Rekord se vidio tek nakon osvježavanja stranice.**
5. **Dashboard je bio nepotrebno uzak na laptopu** — sve rute su dijelile
   ograničenje od 720px, koje ima smisla za listu ali ne za mrežu kartica.

**Rješenje:**

1. Pozadina prebačena u zaseban **fiksni sloj** (`body::before`, `position:
   fixed`, visina ekrana). Nema više veze sa visinom sadržaja, pa se ne
   preskalira. `position: fixed` umjesto `background-attachment: fixed` jer
   potonje na iOS-u pravi trzanje pri skrolu.
2. Meni je **uvijek u DOM-u**, otvara se prelazom `grid-template-rows: 0fr → 1fr`.
   To je jedini način da se visina animira glatko kad se sadržaj ne zna
   unaprijed — `height: auto` se ne animira, a `max-height` sa pogođenom
   vrijednošću daje trzaj na kraju prelaza.
3. **Rekord je sada jedan po vježbi.** `getPersonalBests()` dobio je
   `beforeDate` i isključuje današnji trening, pa prva serija ne postaje rekord
   sama sebi. Poređenje po seriji je odvojeno: strelica **gore** (zeleno) ili
   **dolje** (crveno) prema istoj seriji prošlog treninga.
4. Rekord se računa **u trenutku upisa**, bez ponovnog učitavanja.
5. `--page-wide: 1120px` za ekrane sa mrežom (`/dashboard`, `/exercices`,
   `/blog`); lista ostaje na 720px jer oko ne prati red od 1120px.

**Dodirnuti fajlovi:**
- `src/styles/_base.scss` — pozadina u `body::before`
- `src/styles/_tokens.scss` — `--page-wide`
- `app.component.*` — klasa `wide` po ruti
- `components/training/training.component.ts` — `Delta` tip, `deltaFor()`,
  `hasPr()`, `todayBest()`, `celebrating` / `celebrateKey`
- `components/training/training.component.html` — oznaka rekorda uz naziv
  vježbe, strelice po serijama, meni u omotaču koji se animira
- `components/training/training.component.scss` — `.ex-menu-wrap` prelaz,
  `.set.up` / `.set.down`, `.pr` i slavlje
- `components/dashboard/dashboard.component.scss` — uklonjen naslijeđeni
  `border: 2px solid greenyellow` + `box-shadow: 0 3px 10px white`; mreža
  kartica prelama na jednu kolonu ispod 520px, dvije sekcije se razdvajaju tek
  iznad 860px
- `src/assets/animation/flame-burst.webp` — obrađen snimak (vidi ispod)

**Efekat:** Pozadina miruje. Meni se širi glatko. Rekord je jedan po vježbi, sa
prikazanom kilažom, i pojavljuje se odmah uz animaciju plamena. Serije nose
strelicu gore/dolje prema prošlom treningu.

**Dopuna istog dana — slavlje se pokretalo samo na jednom mjestu:**

Nakon prve verzije, plamen se pojavljivao **isključivo pri upisu nove serije**.
`isPr` se preračunavao na četiri mjesta (učitavanje, upis, izmjena, brisanje),
ali je animacija visjela samo uz upis. Posljedica: izmjena postojeće serije na
veću kilažu je prikazala oznaku rekorda, ali bez ikakve reakcije — a to je
najčešći način ispravljanja pogrešnog unosa u teretani.

Uvedena je `refreshPr()` koju zovu **sve tri radnje** nad serijama. Uz nju ide
polje `prShown` — kilaža za koju je plamen već odsviran — pa se animacija:
- ne ponavlja pri svakom dodiru,
- **pokreće ponovo** ako rekord naraste još jednom u istom treningu (ranije je
  `wasPr` bio već `true`, pa drugo poboljšanje nije davalo ništa),
- **ne pokreće** pri učitavanju ekrana za rekord koji je već postojao —
  `hydrate()` postavlja `prShown` na zatečenu vrijednost.

Potvrđeno u upotrebi: rekord se sada javlja i pri izmjeni serije na veću kilažu.

**Napomene:**
- Vježba bez ijednog ranijeg upisa **nema rekord** — prvi put kad nešto radiš
  nema se šta nadmašiti. Ako se to pokaže kao zbunjujuće, alternativa je posebna
  oznaka „prvi put".
- Vlasnik projekta je dao snimak plamena sa **bijelom pozadinom** (animirani
  WebP, 24 frejma, 540×304). Obrada: prozirnost izvedena kao udaljenost od
  bijele (`255 - min(R,G,B)`), uz **kapiju zasićenosti** — bez nje ostaje siva
  aura od meke sjenke originala, jer je i ona „udaljena od bijele". Boja se
  zatim odmnožava od bijele podloge da plamen ne ostane ispran. Isječeno na
  sadržaj (218×253) i sačuvano kao animirani WebP sa alfom, 176 kB.
- Snimak se poziva sa `?v={{celebrateKey}}` — bez toga bi drugi rekord u istom
  treningu zatekao već odvrćenu animaciju i ništa se ne bi vidjelo.
- `prefers-reduced-motion` isključuje i snimak i animaciju oznake.
- Ostali ekrani (profil, rang lista, vježbe, blog) i dalje čekaju usklađivanje.

---

## [2026-07-26] Trening postaje entitet — zamjena vježbe za jedan dan, „Echo", rekordi
**Tip:** funkcionalnost
**Ref:** Roadmap 2.1 / 2.4, rješava **A6**, D1–D3

**Problem:** Tri odvojene zamjerke vlasnika projekta pokazale su se kao jedan
problem:

1. „Hoću da zamijenim vježbu samo za danas, bez diranja plana."
2. „Hoću da vidim blijedo koliko sam prošli put radio u toj seriji."
3. „Ne želim da odlučim serije/ponavljanja zauvijek pri kreiranju plana."

Trening kao pojam **nije postojao u bazi** — postojali su samo redovi u
`exercice_logs` sa istim datumom. Zato nije bilo gdje zapisati „danas sam
umjesto Bench Pressa radio Machine Chest Press": jedino mjesto za takav podatak
bio je sam plan, a plan je zajednički i trajan.

Uz to, `target_sets` / `target_reps` su se upisivali pri kreiranju plana i
**nigdje se nisu koristili osim za ispis „3 x 10"** — bez provjere, bez prikaza
napretka, bez poređenja sa upisanim.

**Rješenje:** Kad korisnik otvori trening, dan iz plana se **prepisuje** u
sesiju. Od tog trenutka se mijenja sesija, ne plan. Zamjena vježbe, dodavanje,
uklanjanje i serije/ponavljanja tiču se samo tog dana.

**Dodirnuti fajlovi:**
- `supabase/migrations/20260726000000_workout_sessions.sql` — nove tabele
  `workout_sessions` (unique po `user_id, date`) i `session_exercices`
  (sa `replaced_exercice_id` i `is_extra`); `exercice_logs.session_id`; prva
  dva indeksa u cijeloj šemi, od kojih jedan (`user_id, exercice_id, date`)
  postoji upravo zbog upita za prethodni trening
- `services/training.service.ts` — prepisan oko sesije: `getOrCreateSession()`
  (materijalizacija iz plana, sa hvatanjem `23505` za dvostruki klik),
  `replaceExercice()` / `addExercice()` / `removeExercice()`, `updateTargets()`,
  `getEcho()`, `getPersonalBests()`, `getAlternatives()`, `deleteLog()`,
  `renumberSet()`
- `components/training/training.component.ts` — meni po vježbi, modal zamjene sa
  pretragom, modal cilja, brisanje serije sa prenumeracijom
- `components/training/training.component.html` + `.scss` — prikaz „duha",
  zlatna oznaka rekorda, oznake `umjesto X` i `dodano`

**Efekat:**
- **Zamjena za jedan dan.** Meni na vježbi → „Zamijeni za danas" nudi vježbe koje
  dijele mišićnu grupu, sa slikama i pretragom. Rezultat nosi oznaku
  `umjesto Leg Press`. Provjereno: plan i dalje sadrži Leg Press.
- **Echo.** Serije prošlog treninga stoje kao isprekidani, prigušeni „duhovi"
  pored današnjih. Polja za unos su predpunjena prošlim vrijednostima — u
  teretani se najčešće ponavlja isto ili se dodaje mali korak.
- **Rekordi.** Serija koja obori lični rekord postaje zlatna sa ikonom plamena;
  serija koja nadmaši istu seriju prošlog treninga dobija volt obrub.
- **Napredak.** `0/3 × 10` umjesto golog `3 x 10` — cilj sada nešto znači.
- **Brisanje serije** (A6) uz automatsku prenumeraciju, da rupe ne pomjere
  poređenje sa prošlim treningom.

**Napomene:**
- **Zamjena je blokirana ako vježba već ima upisane serije.** Serije su vezane
  za `exercice_id`, pa bi zamjena ostavila podatak u bazi ali ga sklonila sa
  ekrana. Umjesto tihog gubitka — poruka da prvo treba obrisati serije.
- Migracija sadrži rekonstrukciju sesija iz postojećih upisa. **Isti SQL je
  ponovljen i u `seed.sql`** jer se migracije izvršavaju prije seed-a, pa
  lokalno nemaju nad čim da rade. Rezultat: 5 sesija i 47 vježbi iz istorije,
  nijedan upis bez sesije — „Echo" ima prave podatke od prvog dana.
- `workout_sessions.plan_id` je `ON DELETE SET NULL`, namjerno drugačije od
  ostatka šeme gdje brisanje plana odnosi sve u lancu. Istorija treninga treba
  da preživi brisanje plana.
- **Nije riješeno u ovom koraku:** izbor dana treninga (A4 — i dalje se gleda
  ime današnjeg dana) i rest day po `day_type` (A5).
- Lokalna napomena: Docker kontejner baze zna kasniti za satom domaćina, pa
  `current_date` u `psql`-u ne mora odgovarati datumu koji aplikacija koristi.
  Aplikacija dosljedno koristi datum iz pregledača i nigdje se ne oslanja na
  `current_date`.

---

## [2026-07-26] Dizajn sistem — tipografija, tokeni, zaglavlje sa nazad dugmetom
**Tip:** refaktor
**Ref:** Roadmap 4.6, rješava **A8**, C1 (dio), C9

**Problem:** Aplikacija **nije imala postavljen nijedan `font-family`** — cijeli
`styles.scss` je bio `box-sizing`, reset i pozadinska slika. Sve je renderovalo
u browser default serifu. To je bio dobar dio utiska „nekonzistentno i
neprijatno za korišćenje", a ne primijeti se direktno.

Uz to: `greenyellow` i `box-shadow: 0 3px 10px white` ponavljani u svakoj `.scss`
datoteci, `select` sa odsječenim tekstom, footer bez sigurne zone, i jedini
izlaz sa `/training` bilo je dugme na dnu ispod svih vježbi.

**Rješenje:** Dizajn sistem sa tokenima kao jedinim izvorom istine + stalno
zaglavlje. Koncept: **instrumentalna tabla, ne obrazac** — aplikacija se koristi
stojeći, jednom rukom, između serija.

**Dodirnuti fajlovi:**
- `src/styles/_tokens.scss` — boje, tipografska skala, razmaci, radijusi, pokret,
  sigurne zone. `greenyellow` smiren u `--volt #C6FF3B`
- `src/styles/_base.scss` — globalne primitive: polja, `select` sa sopstvenom
  strelicom, `.btn-primary` / `.btn-ghost` / `.btn-danger`, `.panel`, `.card`,
  `.modal-*` (ploča odozdo na telefonu, dijalog na desktopu), `.error`, `.empty`
- `src/styles/_fonts.scss` + `src/assets/fonts/` — Chakra Petch (naslovi),
  IBM Plex Sans (tekst), IBM Plex Mono (brojevi, tabularne cifre). **Servirani
  lokalno**, 268 kB, jer PWA mora raditi offline
- `components/header/` — novo: naslov i odredište strelice po ruti na jednom
  mjestu, da nigdje ne može faliti dugme nazad
- `components/footer/` — sigurna zona iPhone-a, aktivno stanje sa crticom
- `app.component.*` — `100dvh` umjesto `100vh` (mobilni Safari uračunava
  adresnu traku), sadržaj u koloni od 720px
- `index.html` — favicon `j.png` → `assets/j.png` (**A8**)

**Efekat:** Svi ekrani su odmah dobili tipografiju, polja, dugmad i modale bez
pojedinačnih izmjena. Izlazak iz treninga je jedan klik umjesto skrola do dna.

**Napomene:**
- Ostali ekrani (dashboard, profil, rang lista, vježbe, blog) i dalje imaju
  svoje stare kontejnere sa zelenim obrubom — usklađuju se kako se budu dirali.
- Material Icons se i dalje učitavaju sa Google CDN-a (C1 djelimično).

---

## [2026-07-25] Refresh stranice više ne izbacuje korisnika + guardovi
**Tip:** popravka
**Ref:** **A1**, **A2**, **A8**, B1, C2

**Problem:** Hard refresh na `/dashboard`, `/training`, `/profiles` ili `/blog`
skoro uvijek je pokazivao „Nisi ulogovan" iako je sesija postojala. Aplikacija je
radila samo dok se navigira klikovima, bez osvježavanja stranice.

Uzrok je bio redoslijed izvršavanja. `AuthService` konstruktor poziva
`getSession()`, koji je **asinhron** i tek u `.then()` puni `BehaviorSubject`.
Komponente u `ngOnInit` čitaju `getCurrentUser()` **sinhrono**, dakle prije nego
što se to obećanje ispuni — i dobiju `null`. Pri navigaciji kroz aplikaciju
problem se nije vidio jer je sesija dotad odavno bila učitana.

Uz to, nijedna ruta nije imala guard: neprijavljen korisnik je dobijao prazan
ekran umjesto preusmjeravanja, a nepostojeća putanja nije vodila nigdje.

**Rješenje:** `AuthService` sada čuva obećanje `sessionReady` i izlaže
`waitForSession()`. `authGuard` čeka na njega prije nego što pusti navigaciju —
pa je `getCurrentUser()` u komponentama od tog trenutka pouzdan. **Komponente
nisu mijenjane**: ista sinhrona provjera sada radi jer guard garantuje da je
sesija razriješena.

Time jedna izmjena rješava i A1 i A2 — to su bila dva lica istog problema.

**Dodirnuti fajlovi:**
- `services/auth.service.ts:20-45` — `sessionReady` obećanje + `waitForSession()`.
  `getSession()` ima `.catch()` koji neispravan token tretira kao odjavu; bez
  toga bi obećanje ostalo neispunjeno i guard bi visio zauvijek
- `guards/auth.guard.ts` — novo: `authGuard` (čeka sesiju, inače `/login` uz
  `?redirect=`) i `guestGuard` (prijavljenog vraća sa `/login` na `/dashboard`)
- `app-routing.module.ts` — guardovi na svih 6 zaštićenih ruta, `guestGuard` na
  `/login` i `/register`, plus `**` wildcard koji vodi na landing
- `components/login/login.component.ts:25-40` — čita `?redirect=` i vraća
  korisnika tamo gdje je htio, umjesto uvijek na `/dashboard`
- `components/landing/landing.component.ts` — prijavljen korisnik ide pravo na
  `/dashboard` (ranije uvijek na `/login`, pa ga guard vraćao — dva
  preusmjeravanja). Dodan `ngOnDestroy` sa `clearTimeout`: tajmer je ranije
  nastavljao da radi i izbacivao korisnika 4 sekunde nakon odlaska sa landinga
- `app.component.ts:20-35` — poređenje rute sada gleda samo putanju, bez query
  parametara. **Regresija koju je uvela ova izmjena:** otkad guard šalje na
  `/login?redirect=...`, puni `router.url` se više nije poklapao sa `'/login'`,
  pa se footer pojavljivao na ekranu za prijavu
- `index.html:11` — favicon putanja `j.png` → `assets/j.png` (**A8**)
- `services/workout-plan-service.service.ts` + spec — **obrisano**, mrtav kod (**B1**)
- `package.json` — uklonjen `@supabase/ssr`, nigdje se nije koristio (**C2**)
- `angular.json` — dev server prebačen na **port 4300** (port 3000 zauzima druga
  korisnikova aplikacija; 4200 je bio slobodan, ali je odvojen port sigurniji)
- `supabase/config.toml` — `site_url` i `additional_redirect_urls` na 4300

**Efekat:** Refresh na bilo kojoj ruti zadržava prijavljenog korisnika.
Neprijavljen ide na `/login` i nakon prijave se vraća tačno tamo gdje je krenuo.
Nepostojeća putanja vodi na landing. Aplikacija radi na `localhost:4300`.

Provjereno u pregledaču: pun reload `/profiles` (radi), `/nepostojeca-ruta` →
landing → `/dashboard` jer je sesija aktivna, odjava → `/training` →
`/login?redirect=%2Ftraining` → prijava → `/training`.

**Napomene:**
- Audio fajlovi (6 neiskorišćenih, 3.3 MB) **nisu obrisani** iako su mrtvi.
  Prijedlog: iskoristiti ih kao zvuk pri obaranju rekorda (Roadmap 2.4) — to je
  bolja upotreba nego brisanje. Stavka C3 ostaje otvorena dok se ne odluči.
- `docs/03-SIGURNOST.md` je **izbačen iz gita**. Repo je javan, a dokument je
  detaljan popis rupa u sistemu koji je živ i nezaštićen. Vidi
  `docs/03-SIGURNOST.PROCITAJ.md`.

---

## [2026-07-25] Lokalni Supabase — razvoj više ne zavisi od cloud projekta
**Tip:** infrastruktura
**Ref:** Roadmap Faza 0, ADR-0001, rješava **A7**

**Problem:** Sav razvoj se odvijao protiv Filipovog cloud Supabase projekta.
Šema baze nije postojala nigdje kao kod — samo kao stanje u cloudu — pa se nije
mogla mijenjati, verzionisati ni reprodukovati. Kolega nije mogao dobiti radno
okruženje bez pristupa tuđem projektu, a svaka izmjena šeme bi odmah pogađala
prave podatke.

**Rješenje:** Iz punog `pg_dump`-a produkcije (PostgreSQL 17.6) izvedena je šema
u tri migracije i seed sa pravim podacima. Podignut lokalni Supabase stack u
Dockeru. Migracije su pisane **vjerno**, ne „popravljeno" — uključujući i ono što
je očigledno pogrešno (RLS ugašen na 11 od 12 tabela), da bi se lokalno ponašanje
poklapalo sa produkcijom i da bi svaka popravka bila vidljiva kao zasebna
migracija u istoriji.

**Dodirnuti fajlovi:**
- `supabase/migrations/20260725000000_initial_schema.sql` — 12 tabela, FK-ovi,
  funkcije `get_email_by_username()` i `handle_new_user()`, trigger
  `on_auth_user_created`, RLS stanje kakvo jeste, storage bucketi. Komentarima
  (`comment on table/column`) su označena mjesta koja kod tretira posebno —
  npr. da `workout_days.name` služi za poređenje sa danom u sedmici
- `supabase/migrations/20260725000001_storage_policies.sql` — 11 politika nad
  `storage.objects`/`buckets`
- `supabase/migrations/20260725000002_grants.sql` — privilegije za `anon` /
  `authenticated` / `service_role`. **Bez ovog fajla aplikacija javlja
  „permission denied for table workout_plan"** — u cloudu te GRANT-ove dodijeli
  Supabase sam kad se tabela napravi kroz Studio, migracija ih ne dobija
- `supabase/seed.sql` — generisan iz dumpa: 287 redova pravih podataka + 4 naloga
- `supabase/config.toml` — `project_id = "gym-app"`, `site_url` na `localhost:4200`
- `scripts/sync-storage.mjs` — prenosi 42 fajla iz produkcijskog storage-a
  (javni bucketi, ne traži nikakav poseban ključ za čitanje)
- `package.json` — `supabase` kao devDependency + skripte `db:start`, `db:stop`,
  `db:reset`, `db:storage`, `db:studio`
- `angular.json` — `fileReplacements` u produkcijskoj konfiguraciji
- `src/environments/env.ts` — sada gađa lokalni stack
- `src/environments/env.prod.ts` — cloud; ispravljen ključ (`b_` → `sb_`)
- `.gitignore` — `supabase/.temp/`, `supabase/.branches/`, `*dump.sql`, `database/`

**Efekat:** `npm install && npx supabase start && npm start` daje punu aplikaciju
sa pravim podacima, bez interneta i bez pristupa tuđem projektu. Provjereno u
pregledaču: prijava (`marko` / `gymapp123`) → dashboard sa planom „Fikin PPL" →
katalog vježbi sa slikama → leaderboard sa avatarima i rezultatima.

**Napomene:**
- Nalozi u seed-u su **anonimizovani** (`{username}@local.test`, lozinka
  `gymapp123` za sve). Repo je javan, pa pravi emailovi i bcrypt hashevi ne smiju
  u git. Izvorni dump stoji izvan repoa.
- Seed koristi `INSERT`, ne `COPY ... FROM stdin` — Supabase CLI šalje seed kroz
  batch izvršilac koji `COPY` sa podacima ne podržava.
- Seed **ne gasi** trigger `on_auth_user_created` (rola `postgres` nije vlasnik
  `auth.users`). Umjesto toga trigger napravi `profiles` redove, seed ih dopuni
  kroz `on conflict do update`, pa obriše onaj koji u produkciji ne postoji.
- `supabase db reset` **briše i storage**, ne samo tabele. Zato `npm run db:reset`
  radi i reset i ponovni prenos fajlova.
- Šema je namjerno nesigurna jer je takva u produkciji. Ne popravljati usput —
  Faza 5.

---

## [2026-07-25] Dodana četiri Claude Code agenta
**Tip:** infrastruktura
**Ref:** Roadmap 0.2

**Problem:** Zahtjev vlasnika projekta je da se **svaka** izmjena zapiše, kako bi
kolega mogao da prati rad. Oslanjanje na to da će se to raditi ručno ne valja —
dokumentacija zaostane već nakon par izmjena. Uz to, izmjene treba da poštuju
zatečene konvencije (template-driven forme, servisni obrazac, `exercice` umjesto
`exercise`), što se lako propusti.

**Rješenje:** Napravljena četiri specijalizovana agenta u `.claude/agents/`. Svaki
ima usku odgovornost i eksplicitna ograničenja, tako da se poslovi ne preklapaju:
`angular-dev` piše kod ali ne dira bazu ni dokumentaciju; `supabase-migrator` je
jedini koji mijenja šemu; `docs-keeper` ne piše kod nego samo dokumentaciju;
`code-explainer` piše objašnjenja za kolegu.

**Dodirnuti fajlovi:**
- `.claude/agents/docs-keeper.md` — održava `docs/`, upisuje changelog, ažurira
  statuse u roadmapu i `02-STANJE-KODA.md`. Ima tabelu „šta se ažurira kad"
- `.claude/agents/angular-dev.md` — implementacija po konvencijama; tvrda pravila:
  bez novih zavisnosti, bez `any`, bez usputnih sigurnosnih popravki, bez deploya
- `.claude/agents/supabase-migrator.md` — migracije i seed; zabrana rada protiv
  cloud projekta, obavezna provjera koji upiti u `services/` su pogođeni
- `.claude/agents/code-explainer.md` — objašnjenja pisana za autora originalnog
  koda, sa naglaskom na mehanizam problema a ne na kvalitet koda
- `.gitignore` — dodat izuzetak za `.claude/settings.local.json` (lokalne dozvole
  se ne commit-uju, agenti se commit-uju)

**Efekat:** Agenti se commit-uju u repo, pa ih kolega dobija checkoutom i može
koristiti iste. Dokumentovanje izmjena je sada zaseban korak sa vlastitim
pravilima, a ne nešto što se radi „ako se sjetim".

**Napomene:** Agenti su definicije, ne automatizacija — neko ih mora pozvati.
Ako se pokaže da se `docs-keeper` zaboravlja, sljedeći korak je hook u
`.claude/settings.json` koji se okida nakon izmjene fajla.

---

## [2026-07-25] Provjereno da projekat radi na Node 22
**Tip:** infrastruktura
**Ref:** Roadmap 0.1

**Problem:** Angular 16 zvanično podržava Node 16/18, a na mašini je Node v22.17.0.
Postojala je sumnja da će biti potreban `nvm` i dodatni korak u setupu, što bi
otežalo pokretanje kolegi.

**Rješenje:** Pokrenut `npm install` i `ng build --configuration development`.

**Dodirnuti fajlovi:** nijedan (samo provjera).

**Efekat:** `npm install` prolazi (999 paketa, 25s), build prolazi
(bundle 3.99 MB, 7.6s). **`nvm` nije potreban** — setup ostaje `npm install` +
`npm start`. Napomena je upisana u `CLAUDE.md` sekciju 7.

**Napomene:** `npm install` prijavljuje 64 ranjivosti (45 high, 1 critical),
većinom u build alatima. Zabilježeno u `03-SIGURNOST.md` → S7. Nije dirano jer
`npm audit fix --force` na Angular 16 projektu lako razbije build.
