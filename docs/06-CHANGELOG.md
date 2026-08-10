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

---

## [2026-07-26] Zvuk na iPhoneu — otključavanje unutar dodira i rezervni put
**Tip:** popravka
**Ref:** —

**Problem:** Na telefonu (iPhone) zvuk se pri prvom otvaranju prijave nije čuo,
dok je na računaru radio. Ranije popravke (puštanje na prvi dodir,
`audioSession.type = 'playback'`) nisu pomogle.

**Rješenje:** Tri odvojena iOS ograničenja, sva tri prekršena u istom kodu:

1. **Otključavanje nije bilo sinhrono.** Rukovalac dodira je bio `async` i imao
   `await ctx.resume()` prije puštanja tihog uzorka. Svaki `await` prekida vezu
   sa dodirom — iOS tada više ne smatra da je zvuk pokrenuo korisnik. Sada
   `unlock()` nema nijedan `await`: kontekst → `resume()` → tihi uzorak, sve u
   istom potezu.
2. **AudioContext se pravio pri učitavanju stranice**, prije ijednog dodira. Takav
   kontekst na iOS-u zna ostati gluv i nakon `resume()`. Sada se pravi tek u dodiru.
3. **Snimak se dekodirao poslije dodira**, pa je i mreža ulazila u kritični
   trenutak. Sada se bajtovi povlače unaprijed (`fetch` ne traži kontekst), a
   dekodiraju tek kad kontekst postoji.

Dodat je i **rezervni put preko `<audio>` elementa**, otključan istim dodirom.
Web Audio je jedini koji svira kad je bočni prekidač na tihom, ali mu
dekodiranje `.m4a` na starijim iOS-ima zna pasti; `<audio>` uvijek zna da pusti
`.m4a`, ali ga tihi režim utišava. Puštanje ide Web Audiom kad je snimak
dekodiran, a `<audio>` preuzima kad nije.

**Dodirnuti fajlovi:**
- `src/app/services/audio.service.ts` — kompletno prepisan servis: `unlock()`
  (sinhroni, oba puta), `prefetch()` (sirovi bajtovi), `decode()` (dedupliranje),
  `playElement()` (rezervni put), `elementActive` zastavica

**Efekat:** Zvuk se čuje na prvi dodir na ekranu prijave, i na telefonu i na
računaru. Mjereno na produkcijskom buildu: `<audio>` otključan → kontekst
napravljen → tihi uzorak → jedno dekodiranje (253 kB) → klip pušten.

**Napomene:** Dvije greške pronađene tek mjerenjem, ne čitanjem koda:
- `stop()` je pauzirao element i time prekidao (`AbortError`) baš ono puštanje
  koje ga otključava. Sada pauzira samo pravi klip (`elementActive`).
- Isti snimak se dekodirao dvaput paralelno (`unlock()` grije unaprijed,
  `play()` traži odmah zatim) — dva puta po 250 kB. Dodata mapa dekodiranja u toku.

Ako se i dalje ne čuje: provjeriti bočni prekidač na iPhoneu za `<audio>` put i
da Safari nije stariji od 16.4 (`audioSession` API).

---

## [2026-07-26] Jedinstven birač vježbe — jedna komponenta umjesto četiri načina
**Tip:** funkcionalnost / refaktor
**Ref:** Roadmap 1.12

**Problem:** Vježba se bira na četiri mjesta, a svako je to radilo drukčije:

| Mjesto | Prije |
|---|---|
| trening → „Dodaj vježbu" | grupisan katalog sa slikama, pretragom i prekidačem opsega |
| trening → „Zamijeni" | ravna lista vježbi iz iste mišićne grupe, bez kataloga |
| rang lista | obični `<select>` sa `<optgroup>` |
| profil → napredak | isti obični `<select>` |

Dvije stvarne posljedice, ne samo nedosljedan izgled:

1. **Zamjena je bila slijepa ulica.** Nudila je samo vježbe iz iste mišićne
   grupe. Ako željene vježbe nije bilo među njima — nije se imalo šta uraditi,
   jer katalog nije postojao u tom modalu.
2. **`<select>` je na telefonu sistemski točak** sa pedesetak naziva bez slika.
   Vježba se traži naslijepo, listanjem.

**Rješenje:** Izdvojena komponenta `<app-exercice-picker>` koja crta cijeli modal
(pozadinu i karticu), pa je poziv na sva četiri mjesta isti. Nosi pretragu,
katalog grupisan po mišićnim grupama sa slikama, i opcioni prekidač opsega kad
postoji uži izbor:

| Mjesto | Uži izbor | Katalog |
|---|---|---|
| „Dodaj vježbu" | „Za današnji dan" | sve, bez onih koje su već u treningu |
| „Zamijeni" | „Slične vježbe" | sve, bez onih koje su već u treningu |
| rang lista | — | sve |
| napredak | — | sve |

**Dodirnuti fajlovi:**
- `src/app/components/shared/exercice-picker/*` — nova komponenta; izvozi i
  `toPickerGroups()` / `flattenGroups()` za pretvaranje kataloga iz servisa
- `src/app/components/training/training.component.ts:740` — `openAdd()` i
  `openSwap()` sada oba pune `pickerGroups` + `pickerSuggested`; uklonjeni
  `swapOptions`, `swapFilter`, `swapScope`, `swapGroups`, `swapDayIds`,
  `filteredSwapOptions`, `visibleGroups`, `setSwapScope`
- `src/app/components/training/training.component.html` — 55 redova modala
  zamijenjeno jednim pozivom komponente
- `src/app/components/training/training.component.scss` — obrisani stilovi
  birača (15.6 kB → 14.3 kB)
- `src/app/components/leaderboard/*`, `src/app/components/profile/*` —
  `<select>` zamijenjen poljem `.pick-field` koje otvara birač
- `src/styles/_base.scss` — `.pick-field`, globalna primitiva za to polje
- `src/app/app.module.ts` — registracija komponente

**Efekat:** Zamjena vježbe sada ima cijeli katalog, isti kao dodavanje. Rang
lista i napredak imaju slike i pretragu umjesto sistemskog točka. Provjereno u
pregledaču na sva četiri mjesta.

**Napomene:**
- Pretraga se fokusira sama **samo** na uređaju sa mišem
  (`(hover: hover) and (pointer: fine)`). Na telefonu bi autofokus podigao
  tastaturu i pokrio upravo mrežu sa slikama zbog koje birač postoji.
- Kartica ima **fiksnu visinu** (88dvh / 78vh), ne visinu sadržaja — inače bi
  ploča skakala ispod prsta na svako otkucano slovo.
- Uži izbor zna biti prazan (vježba bez upisane mišićne grupe); tada se odmah
  otvara katalog, jer prazan ekran sa prekidačem izgleda kao kvar.
- Escape zatvara birač.

---

## [2026-07-26] Rang lista postaje ekran „Ekipa"
**Tip:** funkcionalnost / popravka / redizajn
**Ref:** A3, Roadmap 1.3 i 1.13

**Problem:** Ekran je bio suv, i to iz tri odvojena razloga.

1. **Pogrešna metrika.** Upit je imao `.eq('set_number', 1)` i uzimao
   **posljednji** zapis po datumu. Najteža serija se nije vidjela ako nije bila
   prva u vježbi, a lakši trenažni dan te je prikazivao kao slabijeg nego
   prošle sedmice.
2. **Pogrešan oblik.** Mjereno na zatečenim podacima: **od 37 vježbi samo 3
   imaju upise od više od jedne osobe.** Podijum je zato u većini slučajeva
   prikazivao jednog čovjeka i dva prazna bloka.
3. **Zatečeni stil.** Posljednji ekran sa zelenim sjajem oko kartice i
   `greenyellow` obrubom.

**Rješenje:**

*Metrika* — rangira se po **najvećoj kilaži podignutoj u periodu**. Neriješeno
se lomi brojem puta koliko je ta kilaža podignuta, pa brojem ponavljanja.
Ponavljanja ne ulaze u rang, samo se prikazuju. Odbačeni su procijenjeni 1RM
(izveden broj koji niko ne prepoznaje kao svoj rezultat) i ukupna kilaža (mjeri
raspored, ne čovjeka).

*Period je dio metrike, ne filter* — podrazumijevano zadnjih **30 dana**, uz
prekidač 2 / 6 / 12 mjeseci. Poenta: ko jednom digne 140 kg i prestane da
dolazi, za mjesec dana ispada sa liste. Rekord se brani.

*Oblik* — dvije nove sekcije iznad rang liste, obje iz postojećih podataka,
**bez migracije**:

| Sekcija | Izvor | Zašto |
|---|---|---|
| Ekipa · ova sedmica | `workout_sessions` | jedina sekcija koja ima sadržaj i za onoga ko još nije upisao nijednu seriju |
| Novi rekordi | `exercice_logs` | pretvara usamljeni upis serije u nešto što ekipa vidi |

*Podijum* je zadržan, ali sada prikazuje samo popunjena mjesta (jedno, dva ili
tri) — prazna postolja izgledaju kao kvar. Ispod njega ide **puna lista** u
kojoj su prva tri mjesta naglašena bojom, a ostali prigušeni, pa ekran radi i
kad nas bude pet-šest.

**Dodirnuti fajlovi:**
- `src/app/services/leaderboard.service.ts` — prepisan: `getLeaderboard(exerciceId, days)`,
  `getTeamWeek()`, `getRecentRecords()`; keš profila; računanje datuma u lokalnoj
  zoni (`toISOString()` uveče vraća sjutrašnji dan)
- `src/app/components/leaderboard/*` — tri sekcije, podijum, puna lista,
  prekidač perioda, ulazne animacije
- `src/app/components/header/header.component.ts:20` — naslov „Rang lista" → „Ekipa"
- `src/app/components/footer/footer.component.html:8` — `aria-label`

**Efekat:** Ekran ima sadržaj i prvog dana, i za člana bez ijednog upisa.
Provjereno u pregledaču na stvarnim podacima, uključujući i podijum sa tri
mjesta (privremeni red u lokalnoj bazi, obrisan poslije provjere).

**Napomene:**
- **Neriješeno dijeli mjesto.** Dvoje sa istim rezultatom su oboje prvi, sljedeći
  je treći. Otkriveno tek na stvarnim podacima — Ćofi i marko oboje 95 kg × 11.
- Poruka o zaostatku **ne pominje ime** vodećeg: „za Ćofi" je pogrešan padež, a
  nadimci se ne mogu pouzdano deklinirati. Piše „Do prvog mjesta ti fali X kg",
  i ne prikazuje se kad si izjednačen na vrhu.
- „bez upisa" umjesto „nije radio" — drugo je rodno određeno.
- Animacije se ponovo puštaju pri promjeni vježbe ili perioda tako što
  `renderKey` ulazi u `trackBy`. Bez `@angular/animations`, koji projekat ne
  koristi. Isključene su za `prefers-reduced-motion`.
- Feed povlači 90 dana zapisa a prikazuje 14 — stariji dani služe kao mjerilo da
  se „rekord" ne prijavi za nešto što je odavno urađeno teže. Prozor je
  ograničen namjerno; bez toga bi se povlačila cijela istorija pri svakom
  otvaranju ekrana.
- Nije rađeno, javljeno kao ideja: relativna snaga (kg / tjelesna težina) i zid
  rekorda po mišićnim grupama.

---

## [2026-07-26] Ekipa: novi redoslijed sekcija i rekordi sa opsegom
**Tip:** funkcionalnost
**Ref:** Roadmap 1.13

**Problem:** Tri stvari nakon prve upotrebe ekrana:

1. Rang po vježbi je bio na dnu, iako je on razlog zbog kojeg se ekran otvara.
2. Spisak rekorda je bio **hardkodiran na 8** (`getRecentRecords(limit = 8)`),
   bez načina da se vidi više. Kad trenira samo jedna osoba, tih osam su svi
   njeni, pa spisak izgleda kao da je nešto zaglavilo.
3. Nije se moglo vidjeti **samo svoje** rekorde — a to nigdje drugo u aplikaciji
   ne postoji, ni u profilu.

**Rješenje:**

*Redoslijed* — Rang po vježbi → Ekipa · ova sedmica → Oboreni rekordi.

*Rekordi* — servis više ne siječe spisak. `getRecentRecords(limit)` je postao
`getRecords()` i vraća sve što je u prozoru od 90 dana oborilo prethodnu kilažu,
najnovije prvo. Komponenta prikazuje 8 i dodaje po 8 dugmetom „Učitaj još (N)",
gdje N pokazuje koliko ih još ima. Pošto je cio spisak već u memoriji, i
prekidač i dugme rade **bez ijednog novog upita**.

*Opseg* — prekidač „Svi / Moji". Prozor je proširen sa 14 na 90 dana prikaza,
jer je za lični spisak dvije sedmice prekratko. Prazan slučaj ima svoju poruku:
„Još nemaš oboren rekord u zadnja tri mjeseca."

**Dodirnuti fajlovi:**
- `src/app/services/leaderboard.service.ts` — `getRecords()` bez sječenja;
  `FEED_HISTORY_DAYS`/`FEED_SHOW_DAYS` spojeni u `RECORD_WINDOW_DAYS = 90`
- `src/app/components/leaderboard/leaderboard.component.ts` — `recordScope`,
  `recordsShown`, `scopedRecords`, `visibleRecords`, `moreRecords`
- `src/app/components/leaderboard/leaderboard.component.html` — nov redoslijed
  sekcija, prekidač opsega, dugme „Učitaj još"
- `src/app/components/leaderboard/leaderboard.component.scss` — `.scope-switch`, `.more`

**Efekat:** Provjereno u pregledaču: „Moji" za marka tačno prijavljuje da nema
oborenih rekorda (sva tri njegova upisa su prvi put ta vježba, pa nemaju šta da
obore), „Svi" prikazuje 8 + „Učitaj još (1)".

**Napomene:** Kašnjenje animacije koristi `i % 8`, pa se pri dodavanju novih
osam animira samo novi blok — već prikazani redovi zadržavaju svoje čvorove
(`trackBy` im se ne mijenja) i ne trepere.

---

## [2026-07-26] Pokret: ulazne animacije, klizni prekidač, kalendar treninga, prevlačenje
**Tip:** funkcionalnost / popravka
**Ref:** Roadmap 1.14, 1.15, 1.16

### 1. Ulazne animacije (vježbe i dashboard)

Katalog vježbi i dashboard su se pojavljivali odjednom, kao da su iskočili.
Sada naslovi grupa i kartice ulaze stepenasto.

Kašnjenje računa komponenta (`cardDelay`) i postavlja ga inline, jer zavisi od
rednog broja grupe i kartice. **Ograničeno je** — katalog ima 37 vježbi u 6
grupa; bez granice bi posljednja čekala preko dvije sekunde i ekran bi djelovao
sporo umjesto tečno. Mjereno: najduže kašnjenje je 545 ms.

**Zamka koja je zamalo prošla:** `animation-fill-mode` mora biti `backwards`, a
**ne** `both`. `both` zadržava završno stanje ključnog kadra i time zaključava
`transform`, pa `:hover` podizanje kartice poslije animacije više ne bi radilo.
Provjereno u pregledaču: poslije animacije `transform: none`, a na hover
`matrix(1, 0, 0, 1, 0, -2)`.

### 2. Klizni prekidač (`.seg`)

Aktivna boja je ranije samo preskakala s jednog dugmeta na drugo, bez veze
između dva stanja. Sada se ispod dugmadi klizi podloga, pa se vidi odakle je
izbor otišao i kuda.

Podloga je zaseban element, ne `background` na dugmetu — `background-color` se
ne može animirati po položaju. Položaj nosi `--seg-index`, broj polja
`--seg-count`. Stil je u `src/styles/_base.scss` jer ga koriste **tri** mjesta:
„Svi / Moji", prekidač perioda, i opseg u biraču vježbi.

### 3. Kalendar treninga u profilu

**Nije bila potrebna nikakva migracija.** `workout_sessions` postoji otkad je
dodato dugme „Trening gotov" i nosi tačno ono što treba — korisnik i datum.
Broj serija iz `exercice_logs` određuje samo jačinu zelene (4 nivoa).

Mjesec, ne posljednjih 30 dana: dan u sedmici mora stajati u svojoj koloni,
inače se ne vidi obrazac (npr. da se nedjeljom nikad ne trenira). Godina se
povlači jednom, pa je listanje mjeseci trenutno, bez novog upita.

Šest brojki: ovog mjeseca, niz sedmica, sedmično, najbolji mjesec, treninga i
serija za 12 mjeseci. Niz se broji **po sedmicama, ne po danima** — niz po
danima bi prekinuo svaki dan odmora, pa bi skoro uvijek pisalo 1.

Polja su namjerno mala i mreža je ograničena po širini; prva verzija je bila
`repeat(7, 1fr)` preko cijele kartice, što je na računaru zauzimalo pola ekrana
ni za šta. Na širem ekranu kalendar i brojke stoje jedno pored drugog.

### 4. Trzaj pri otvaranju plana — pravi uzrok

Prvo sam pogrešno zaključio da okvir „raste od nule" i isključio prelaz.
Stvarni uzrok je drugi: okvir je stajao na `height: auto` dok podaci ne stignu, a
**`auto → 610px` se u CSS-u ne interpolira**. `transition: height` je postojao,
ali nije imao šta da radi — visina je skakala u jednom kadru.

Rješenje: početna visina je broj (`deckStartHeight = 320`), nikad `auto`. Prva
izmjerena visina se primjenjuje tek nakon dva `requestAnimationFrame`-a, da
pregledač stigne da iscrta početnu — inače spoji obje promjene u jedan kadar i
opet nema animacije. Prelaz produžen sa 320 na 460 ms, jer okvir pređe i po 300
piksela odjednom.

Dodat je i placeholder dok plan stiže, iste visine kao početni okvir.

### 5. Prevlačenje kroz dane plana

Na telefonu su strelice bile jedini način da se promijeni dan. Dodato je
prevlačenje prstom po samim kartama.

Namjerno se **ne** koristi `touchmove` sa praćenjem prsta — karte bi tada morale
da prate pomjeraj, a to se tuče sa 3D transformacijama špila. Mjeri se samo
odakle dokle je prst otišao: prag 50 px, i pokret mora biti pretežno vodoravan
(`|dx| > |dy| * 1.5`), inače bi svako skrolovanje kroz duži dan mijenjalo
stranicu. `touch-action: pan-y` ostavlja uspravno skrolovanje pregledaču.

**Dodirnuti fajlovi:**
- `src/styles/_base.scss` — `.seg`, `.seg-thumb`
- `src/app/components/exercices/*` — `groupDelay`, `cardDelay`, `card-in`, `group-in`
- `src/app/components/dashboard/*` — ulazne animacije, `deckStartHeight`,
  `onDeckTouchStart`/`onDeckTouchEnd`, `.swipe-hint`, `.view-loading`
- `src/app/components/profile/*` — kalendar, šest brojki, `computeWeekStreak`,
  `computeWeekAvg`, `computeBestMonth`
- `src/app/services/profile.service.ts` — `getTrainingCalendar`
- `src/app/components/leaderboard/*`, `src/app/components/shared/exercice-picker/*` —
  prelazak na `.seg`
- `angular.json` — `anyComponentStyle` granica greške 16 → 20 kB

**Napomene:** `dashboard.component.scss` je sada 17 kB i granica je podignuta da
build prođe. To je zakrpa, ne rješenje — modal plana treba da postane zasebna
komponenta, što je i ranije zapisano kao dug.

Datumi se svuda računaju u lokalnoj zoni pa pretvaraju u `YYYY-MM-DD`;
`toISOString()` se ne koristi jer uveče vraća sjutrašnji dan.
## [2026-07-26] Blog — prikazan datum postavljanja fajla
**Tip:** funkcionalnost
**Ref:** korisnički zahtjev

**Problem:** Na blog stranici nije se vidjelo kad je neka slika/gif/video
postavljen(a).

**Rješenje:** Supabase Storage već sam bilježi `created_at` za svaki fajl u
bucket-u, i `BlogService.listMedia()` ga je već čitao i sortirao po njemu
(`blog.service.ts:23,37`) — samo se nikad nije prikazivao. Dodata oznaka datuma
preko svake kartice u galeriji (donji lijevi ugao, kao mala pilula), i u
fullscreen prikazu (lightbox) uz vrijeme.

**Dodirnuti fajlovi:**
- `src/app/components/blog/blog.component.html:23,32` — dodat `.media-date`/
  `.lightbox-date` span sa `date` pipe-om
- `src/app/components/blog/blog.component.scss` — stilovi za oba

**Efekat:** Svaka objava na blogu sad pokazuje datum kad je postavljena, i u
galeriji i u fullscreen prikazu.

**Napomene:** Datum je datum upload-a u Storage (`created_at` samog fajla), ne
neko posebno polje koje bi korisnik mogao izmijeniti — nema tabele u bazi za
blog objave, sve dolazi direktno iz bucket-a.

---

## [2026-07-26] Spajanje `main` grane — kompresija zadržana, rang lista naša
**Tip:** infrastruktura
**Ref:** —

**Problem:** Filip je paralelno radio na `main` grani, ne znajući da je rang
lista u toku i kod nas. Njegova grana je donijela četiri stvari, od kojih se
dvije sudaraju sa našim radom:

| Njegov commit | Šta donosi | Odluka |
|---|---|---|
| `5c91bd4 kompresija` | kompresija slika i videa za blog | **uzeto** |
| `be1d765` — praćenje težine | `weight_logs` tabela + grafikon | **uzeto** |
| `be1d765` — birač vježbe | sopstveni modal sa katalogom | odbačeno, naš `<app-exercice-picker>` ostaje |
| `be1d765` — rang lista | njegova verzija | odbačeno, naš ekran „Ekipa" ostaje |
| `f538f78 env` | `env.ts` prebačen na cloud | odbačeno, naš ostaje lokalni |

**Rješenje:** `git merge origin/main` na grani `XFactor`, uz ručno razrješavanje.
Prije spajanja napravljeni `backup/XFactor-prije-merge-main` i tag
`backup-prije-merge-2026-07-26`.

Kompresija se spojila **bez ijednog konflikta** — dodaje `@ffmpeg/*` zavisnosti,
`tsconfig.worker.json`, `src/app/shared/{image,video}-compress.ts` i
`dummy.worker.ts`, plus izmjene u blogu i `angular.json` (web worker).

Praćenje težine je **zadržano iako je bilo u istom commitu kao odbačeni birač**.
To je zasebna funkcija, ne sudar: `weight_logs` migracija i metode u
`ProfileService` spojile su se čisto, a logika grafikona je prenesena u našu
verziju komponente. Da je uzeto „naše" po cijelom fajlu, Filipova funkcija bi
nestala i sa `main` grane kad on spoji nazad.

**Dodirnuti fajlovi (razriješeni ručno):**
- `leaderboard.component.{html,scss,ts}` — naša verzija
- `profile.component.ts` — naša verzija + prenesen Filipov kod za težinu
  (`loadWeightHistory`, `submitWeightLog`, `buildWeightChart`)
- `profile.component.html` — naša verzija + njegov modal za težinu, prestilizovan
- `env.ts` — naša verzija (lokalni Supabase)
- `docs/06-CHANGELOG.md` — zadržana oba unosa
- `buildAreaPath` — potpis proširen na `{x, y}[]` da prima i tačke težine

**Efekat:** Produkcijski build prolazi. Migracija `20260726010000_weight_logs`
primijenjena na lokalnu bazu (`supabase migration up`), podaci netaknuti.

**Napomene:**
- **Filip ne treba da mijenja `env.ts`.** Za rad protiv cloud baze već postoji
  `npm run start:cloud` (konfiguracija `cloud` u `angular.json`). Ako nastavi da
  prepravlja `env.ts`, isti konflikt će se ponavljati pri svakom spajanju.
- Nakon `git pull` obavezno `npm install` **pa restart `ng serve`** — webpack
  razrješava module pri pokretanju, pa server pokrenut prije instalacije javlja
  `Cannot find module '@ffmpeg/ffmpeg'` iako su paketi na disku.
- `color-scheme: dark` dodat na `html` — bez toga je nativno polje `type="date"`
  u modalu za težinu bijelo usred tamnog ekrana.

---

## [2026-07-26] Statistika treninga: šta se broji kao trening i prekidač opsega
**Tip:** popravka / funkcionalnost
**Ref:** Roadmap 1.15

**Problem:** Marko je primijetio da Filipu ispada prosjek **7,0 treninga
sedmično**, iako trenira šest dana i ima rest day. Dva odvojena kvara.

### 1. Rest day se brojao kao trening

`getOrCreateSession()` pravi red u `workout_sessions` već pri **otvaranju**
ekrana treninga — ne pri upisu serije. Na rest dayu se to dešava uvijek: dan
nema nijednu vježbu, ekran se otvori, sesija nastane. Kalendar i sedmica ekipe
su brojali svaki takav red kao odrađen trening.

Nije stvar rest daya nego **svakog dana kad se ekran samo otvori**. Vidjelo se i
u lokalnim podacima: `marko 2026-07-25` — nula serija, nije završen, a brojao se.

**Rješenje:** dan se broji kao trening samo ako ima **bar jednu upisanu seriju**
ili je sesija **izričito završena** dugmetom „Trening gotov" (`finished_at`).
Isto pravilo na oba mjesta — `ProfileService.getTrainingCalendar` i
`LeaderboardService.getTeamWeek`.

Efekat na zatečenim podacima: marko je pao sa 2 na 1 trening u julu.

### 2. Prosjek se dijelio sa proteklim vremenom, ne sa opsegom

`broj treninga ÷ ((danas − prvi trening) / 7)`. Ko u ponedjeljak i utorak odradi
dva treninga, dijeli 2 sa 2/7 sedmice → **7,0**. To je projekcija, ne mjerenje.

Prva popravka („broji samo pune sedmice") je riješila 7,0 ali uvela goru zbrku:
„7 dana" je znalo pokazati **0 treninga a prosjek 2,0**, jer je brojač gledao
zadnjih 7 dana a prosjek prošlu punu sedmicu — dva različita prozora u istom
redu brojki.

**Konačno rješenje:** `broj treninga u opsegu ÷ broj sedmica u opsegu`, uz donju
granicu od jedne sedmice (da prva tri dana ne daju 7,0) i gornju granicu na
dužinu istorije (da mjesec dana korišćenja uz opseg „Godina" ne da 0,1).

Provjereno na sintetičkoj istoriji od 6 mjeseci sa ritmom 3×sedmično:

| Opseg | Treninga | Sedmično |
|---|---|---|
| 7 dana | 0 (pauza) | 0,0 |
| 30 dana | 9 | 2,1 |
| 90 dana | 35 | 2,7 |
| Godina | 78 | 2,9 |

### 3. Prekidač opsega

Statistika više nije fiksna na 12 mjeseci — `.seg` prekidač bira
**7 / 30 / 90 dana / godina**, i pet brojki prati izbor: treninga, serija,
sedmično, serija po treningu, najbolji dan. Šesta (niz sedmica) namjerno **ne**
prati opseg — niz teče od danas unazad bez obzira šta je izabrano — pa ima
isprekidan obrub da se to vidi bez dodatnog teksta.

Sve se računa iz već učitanih dana, bez novog upita pri promjeni opsega.

**Dodirnuti fajlovi:**
- `src/app/services/profile.service.ts` — `getTrainingCalendar` filtrira
  `.not('finished_at', 'is', null)`
- `src/app/services/leaderboard.service.ts` — `sessionsSince` isto + nova
  `logDatesSince`, unija u `getTeamWeek`
- `src/app/components/profile/*` — `statRange`, `computeRangeStats`,
  prepisan `computeWeekAvg`, uklonjen `computeBestMonth`

**Napomene:** Prazne sesije i dalje nastaju u bazi pri otvaranju ekrana; sada se
samo ne broje. Da se ne prave uopšte, `getOrCreateSession` bi morao da odloži
upis dok se nešto ne upiše — veći zahvat, i te redove je korisno imati kao trag.

---

## [2026-07-26] Opsezi u cijelim sedmicama + unos težine u našem stilu
**Tip:** popravka / redizajn
**Ref:** Roadmap 1.15

### 1. „Sedmično" je konačno tačno

Marko: *„ne može da bude 6 puta nedeljno na 30 dana ako je u 30 dana bio samo
jednu nedelju 6 puta"* — i bio je u pravu. Peta verzija formule, i svaka je
prethodna griješila na isti način: dijelila je **nečim drugim umjesto dužinom
opsega**.

| # | Djelilac | Šta je davalo |
|---|---|---|
| 1 | `(danas − prvi trening) / 7` | 2 treninga pon+uto → **7,0** |
| 2 | broj punih sedmica od početka | „7 dana": 0 treninga, prosjek 2,0 |
| 3 | `min(opseg, istorija) / 7` | 6 treninga u 1 sedmici, opseg 30 dana → **6,0** |
| 4 | `30 / 7 = 4,3` | tačno, ali opseg nije cio broj sedmica |
| **5** | **broj sedmica u opsegu (1, 4, 13, 52)** | **tačno i bez razlomka** |

Ključna izmjena: **opsezi su sada zadati u cijelim sedmicama**, ne u danima. U
30 dana stane 4,3 sedmice, pa se broj razvodni; u 4 sedmice stane tačno 4.
Natpisi su zaokruženi na govorni jezik — `Sedmica · Mjesec · 3 mjeseca · Godina`
= 1 / 4 / 13 / 52 sedmice.

Provjereno na poznatim ritmovima:

| Stvarni ritam | Sedmica | Mjesec | 3 mjeseca | Godina |
|---|---|---|---|---|
| 6 treninga, sve u jednoj sedmici | 6,0 | **1,5** | 0,5 | 0,1 |
| stabilno 3× sedmično | 3,0 | 3,0 | 3,0 | 3,0 |
| stabilno 6× sedmično (rest četvrtak) | 6,0 | 6,0 | 6,0 | 5,9 |

### 2. Unos težine prešao na naš dizajn

Filipova funkcija je zadržana u cjelini, promijenjen je samo izgled — koristila
je podrazumijevana polja i dugmad.

- **Trenutna težina krupno** + ukupna promjena od prvog upisa
- **Prečica „danas"** u polju za datum — u praksi se upisuje današnji dan
- **Polje za kilograme** sa `kg` sufiksom i `inputmode="decimal"`
- **Spisak upisa** sa razlikom u odnosu na prethodni (`+1,2` / `−0,8`)

Razlika je namjerno **bez boje koja sudi**: neko se goji namjerno, neko mršavi,
pa „+1,2" nije ni dobro ni loše dok se ne zna cilj.

### 3. Dvije zatečene greške usput

**`input[type="date"]` nije bio u globalnom pravilu za polja.** Zbog toga je
birač datuma zadržavao pregledačev izgled — siva podloga i visina od 25px usred
obrasca gdje su sva ostala polja 46px. Dodat u `_base.scss`, uz obrtanje boje
ikone kalendara.

**Oznake ose grafikona su se odsijecale.** `chartPaddingLeft = 46`, a oznaka se
crta od `chartPaddingLeft − 8` unalijevo — „82.5 kg" nije stalo, pa je pisalo
„l2.5 kg". Povećano na 62 lijevo i 34 desno (posljednja tačka nosi centriranu
oznaku iznad sebe). Popravlja i grafikon napretka po vježbi, koji dijeli iste
konstante.

**Dodirnuti fajlovi:**
- `src/app/components/profile/profile.component.ts` — `STAT_RANGES` u sedmicama,
  prepisan `computeWeekAvg`, `buildWeightRows`, `weightCurrent`,
  `weightTotalChange`, `formatDelta`, `setWeightDateToday`, veći padding grafikona
- `src/app/components/profile/profile.component.{html,scss}` — modal težine
- `src/styles/_base.scss` — `input[type="date"]`

---

## [2026-07-26] Sopstveni birač datuma, birač za poređenje, animiran grafikon, futer na telefonu
**Tip:** funkcionalnost / popravka / redizajn
**Ref:** Roadmap 1.15

### 1. Sopstveni birač datuma (`<app-date-picker>`)

Nativni `<input type="date">` se **ne može** stilizovati. CSS dohvata samo okvir
polja; kalendar koji iskoči na klik crta pregledač po sistemskoj temi, i nijedan
selektor ga ne dosegne — usred tamnog ekrana se otvarao bijeli Chrome-ov
kalendar sa plavim dugmadima.

Nova komponenta koristi istu mrežu i iste tokene kao kalendar treninga u
profilu, pa se dva kalendara u aplikaciji ne razlikuju. Radi sa `YYYY-MM-DD`
nizom, ne sa `Date` — baza čuva dan bez vremena, a `Date` uvodi zonu u nešto što
je samo dan u mjesecu. Budući datumi su onemogućeni (`max`), otvara se na
mjesecu već izabranog datuma, Escape zatvara.

### 2. „Uporedi sa" više nije `<select>`

Posljednji `<select>` u aplikaciji. Zamijenjen poljem `.pick-field` i modalom sa
spiskom članova, kvačicom na izabranom i opcijom „Niko".

### 3. Grafikon napretka

- **Linija se crta**, ne pojavljuje. `pathLength="1"` u predlošku normalizuje
  dužinu putanje, pa `stroke-dasharray`/`dashoffset` rade iz CSS-a — bez
  `getTotalLength()` u JavaScriptu i bez ponovnog računanja pri promjeni podataka.
- **Tačke i natpisi** ulaze stepenasto, poslije linije.
- **Tuđa linija** je isprekidana i bez sjaja, naša puna sa `drop-shadow` — vidi
  se čija je koja i bez legende.
- `transform-box: fill-box` na grupama tačaka: bez toga se `transform` na SVG
  grupi računa od koordinatnog početka crteža, pa tačke ulijeću iz ugla.

**Zatečena greška:** površina ispod linije bila je **crna mrlja**. Gradijenti
`progressAreaGradientMe/Compare` su bili definisani u `<defs>`, ali ih putanje
nisu koristile — nedostajao je `fill`, a SVG bez njega podrazumijeva crno. Uz
popravku, boje gradijenta su usklađene sa linijama (volt / zlatna) umjesto
zatečenih tirkizne i crvene.

### 4. Futer na telefonu bježao pri skrolu

`.shell` je imao `min-height: 100dvh`. `dvh` prati traku adresne linije **uživo**
— visina stranice se mijenja usred skrola, pa se fiksirani futer vidljivo otme,
smiri, pa opet skoči. Prebačeno na `100svh` (najmanja moguća visina, ne mijenja
se pri skrolu). Isto u prijavi i registraciji.

Dodato i `overscroll-behavior-y: none` na `body` — na iOS-u se pri „rubber band"
povlačenju fiksirani futer odvaja od ivice ekrana.

**Napomena:** ovo su dva uzroka koja se mogu ukloniti CSS-om. Ako na iPhoneu i
dalje bude primjetno pri naglom skrolu, preostaje strukturna promjena: `.shell`
fiksne visine u kojoj skroluje **sadržaj**, a ne stranica. Tada futer nema veze
sa trakom adresne linije, ali se traka nikad ne sakriva.

**Dodirnuti fajlovi:**
- `src/app/components/shared/date-picker/*` — nova komponenta + `formatIsoDate`
- `src/app/components/profile/*` — birač datuma, birač za poređenje, animacije
- `src/app/app.component.scss`, `login`, `register` — `dvh` → `svh`
- `src/styles/_base.scss` — `overscroll-behavior-y`
- `src/app/app.module.ts` — registracija

---

## [2026-07-26] Popravka: birač osobe za poređenje nije imao stilove
**Tip:** popravka
**Ref:** —

**Problem:** U prethodnoj izmjeni je napisan markup modala za izbor osobe
(`.cmp-row`, `.cmp-av`, `.cmp-check`…), ali **nijedno od tih pravila nije
dodano u SCSS**. Modal se otvarao kao neoblikovan spisak — dugmad bez podloge,
avatari bez okvira, kvačica u boji teksta.

Greška je moja i tipična za razdvojen predložak i stil: build prolazi, TypeScript
ne prijavljuje ništa, jer nedostatak CSS klase nije greška ni za koga osim za oko.

**Rješenje:** Dodata pravila u `profile.component.scss` — red visine 52px sa
avatarom, naglašen izabrani red (volt podloga i obrub), isprekidan krug za
„Niko", stepenasti ulaz redova.

**Provjera:** Otvoren modal, izabran „marko" — polje se ažurira, legenda se
pojavljuje sa dvije boje (volt = ti, zlatna = drugi), grafikon povlači i drugu
liniju.

**Napomena za ubuduće:** kad se doda markup sa novim klasama, provjeriti
`grep -c "nova-klasa" *.scss` prije commita. Ovdje bi to odmah dalo nulu.

---

## [2026-07-26] Sve vrijeme, lični rekord, vremenska osa grafikona, futer bez rupe
**Tip:** funkcionalnost / popravka
**Ref:** Roadmap 1.13, 1.15

### 1. Futer na iPhoneu — strukturna popravka

Simptom: pri skrolu nadolje traka sa adresom se skupi, fiksirani futer ostane
gdje je bio, i **između njega i donje trake nastane rupa**. Na skrol nagore
izgleda uredno.

Uzrok: `position: fixed` se pozicionira prema *layout* viewportu, koji se u
trenutku skupljanja trake još nije proširio. To se **ne može** popraviti CSS-om
dok stranica skroluje — probano sa `svh` umjesto `dvh` (pomaže kod visine, ne
kod ovoga) i sa `overscroll-behavior`.

Rješenje: **stranica se više uopšte ne skroluje.** `.shell` je visine ekrana sa
`overflow: hidden`, zaglavlje i futer su obična djeca u toku (`flex: none`), a
skroluje samo srednji `.scroll-area`. Traka sa adresom se tada nikad ne skuplja.

Cijena: traka ostaje stalno vidljiva, gubi se tridesetak piksela. Provjereno da
se ništa ne oslanja na skrol prozora (`window.scrollTo`, `scrollIntoView` — nema
nijednog poziva), a modali su `position: fixed` u globalnom sloju pa ih
`overflow: hidden` na pretku ne siječe.

### 2. „Sve vrijeme" na rang listi

`PeriodDays` dobio vrijednost `0` = bez donje granice; upit tada izostavlja
`.gte('date', …)`. Rekord u tom pogledu ne ističe — vidi se ko je **ikad**
najviše digao.

### 3. Lični rekord u profilu

Na rang listi se sopstveni maksimum lako izgubi: ko je slabiji od ostalih, nikad
ne dođe na podijum pa svoj broj ne vidi nigdje — čak ni pod „Sve".

Zato profil, uz izabranu vježbu, prikazuje **Moj rekord · sve vrijeme**: najveća
kilaža ikad sa najviše ponavljanja na njoj i datumom. Vatra je ista ikona kao
oznaka rekorda u treningu — ista stvar treba da izgleda isto na oba mjesta.

Računa se iz cijele istorije, ne iz prozora grafikona; `getProgress` ionako
vraća sve bez vremenskog ograničenja.

### 4. Grafikon dobio vremensku osu

Ranije su tačke stajale po **rednom broju upisa**, ravnomjerno razmaknute — dva
upisa razmaknuta tri sedmice izgledala su isto kao dva uzastopna dana, a jedan
jedini upis bio je tačka u praznini. Zato je grafikon „bio čudan na početku".

Sada X osa nosi **vrijeme**, preko cijelog izabranog prozora. Dodat prekidač
`1m / 3m / 6m / Sve` i strelice za pomjeranje prozora unazad po jednoj dužini
opsega. Širina crteža je stalna (560), pa se mijenja gustina a ne dužina — nema
vodoravnog skrola. Oznake na X osi su ravnomjerne po vremenu (5 tačaka), ne po
upisima, inače bi se pri više upisa u istoj sedmici preklopile.

### 5. Kratki natpisi na prekidačima

`30 dana / 2 mjeseca / 6 mjeseci / Godina / Sve` je bilo preširoko — pet natpisa
se grčilo u širini telefona. Sada `1m / 2m / 6m / 1g / Sve`, a pun tekst je
pomjeren u rečenicu ispod liste („Najveća kilaža u posljednjih 30 dana."), gdje
ima mjesta. Isto u profilu, za oba prekidača.

Mjereno na uskom ekranu: polje 103px, natpis 15–22px.

### 6. Puna lista dobila naslov

Lista ispod podijuma je **oduvijek** prikazivala sve članove, ali je bez naslova
izgledala kao slučajno ponavljanje podijuma. Dodat naslov „Svi" i napomena šta
se mjeri, plus dugme „Prikaži još" kad članova bude više od šest.

**Dodirnuti fajlovi:**
- `src/app/app.component.{html,scss}` — okvir sa unutrašnjim skrolom
- `src/app/components/footer/footer.component.scss`, `header.component.scss` — bez `fixed`/`sticky`
- `src/app/services/leaderboard.service.ts` — `PeriodDays = 0`, `full` natpisi
- `src/app/components/leaderboard/*` — „Svi" naslov, `Prikaži još`
- `src/app/components/profile/*` — `personalBest`, `CHART_RANGES`, prepisan `buildChart`
- `src/styles/_base.scss` — `white-space: nowrap` na `.seg button`

---

## [2026-07-26] Blog: iz mreže u feed, sa autorom i grupisanjem
**Tip:** redizajn / funkcionalnost
**Ref:** Roadmap 1.17

**Problem:** Posljednji ekran sa zatečenim stilom. Ravna mreža kvadrata bez
ijednog zaglavlja — nije se vidjelo ni kad je šta objavljeno, ni ko je objavio,
ni da je nešto novo. Marko: *„nestrukturiran, nema karaktera"*, a poslije prve
verzije i *„budno za gledanje"*.

**Rješenje:**

*Autor bez ijedne nove tabele.* Supabase sam upisuje `owner` u
`storage.objects` pri otpremanju, a `.list()` to vraća — treba samo mapiranje
`id → korisničko ime` iz `profiles`. Dodat `ProfileService.getAllProfiles()`.

> Dvije postojeće objave u lokalnom seedu nemaju autora jer ih je ubacila
> skripta, bez prijavljenog korisnika. Prikazuju se kao „—"; **nove objave iz
> aplikacije imaće ime**, jer se otpremaju sa korisnikovom sesijom.

*Grupisanje po periodu* — Danas / Juče / Ove sedmice / pa po mjesecima. Datum
objave već postoji u metapodacima, pa vremenska os ne košta ništa.

*Feed umjesto mreže.* Prva verzija je bila mreža sa jednom „dvostrukom" pločom
za ritam, ali je i dalje bila naporna: nekoliko slika različitog sadržaja jedna
do druge, sve isječene na kvadrat. Sada je **jedna objava po redu** — avatar,
ime i vrijeme iznad, pa slika. Slika se prikazuje **cijela** (`object-fit:
contain`), ne isječena; kod nas su i uspravne fotografije s telefona i vodoravni
snimci, a sjecanje na kvadrat je odsijecalo pola sadržaja. Gornja granica
`62svh` sprječava da uspravna slika pojede ekran.

*Pregled* dobio traku sa autorom i vremenom, brojač („3 / 12"), strelice,
tastaturu (←/→/Esc) i prevlačenje prstom. Ranije se otvarala jedna slika bez
načina da se pređe na sljedeću.

*Kompresija i otprema* — jedna traka napretka umjesto tri odvojena reda teksta.
Kad se napredak ne može izmjeriti, traka putuje umjesto da stoji na 100%.

**Zatečena greška:** `/blog` je u zaglavlju imao naslov **„Ekipa"**. To je bilo i
prije, ali se nije primjećivalo dok rang lista nije preimenovana u „Ekipa" — od
tada su dva ekrana nosila isti naslov.

**Dodirnuti fajlovi:**
- `src/app/services/blog.service.ts` — `ownerId`, `size` u `BlogMediaItem`
- `src/app/services/profile.service.ts` — `getAllProfiles()`
- `src/app/components/blog/*` — grupisanje, feed, pregled sa kretanjem
- `src/app/components/header/header.component.ts:22` — naslov „Blog"

**Napomene:** provjereno da svih 40 klasa iz predloška ima stil (nakon što je
isti propust ranije napravljen kod birača osobe). Objave se i dalje ne mogu
brisati iz aplikacije — to traži i RLS pravilo, pa ide zasebno.

---

## [2026-07-26] Ko trenira sada, bilješka uz trening, offline upis
**Tip:** funkcionalnost
**Ref:** Roadmap 1.18, 2.7

Tri stvari, sve **bez ijedne izmjene baze**. Dvije od njih koriste kolone koje
su postojale otkad je tabela napravljena, a nikad se nisu koristile.

### 1. Ko trenira sada

`workout_sessions.started_at` ima `default now()`, a prazan `finished_at` znači
da trening traje. Ni jedno ni drugo se nigdje nije čitalo.

**Uslov nije samo otvorena sesija.** Red nastaje već pri otvaranju ekrana
treninga, pa bi inače pisalo da trenira i onaj ko je samo bacio pogled. Traži se
i **bar jedna upisana serija danas**, plus granica od 4 sata — `finished_at`
ostane prazan i kad neko zaboravi da pritisne „Trening gotov".

Stoji na **dnu dashboarda**, poslije planova. Prva verzija je bila uz dugme za
trening, ali je tamo djelovala nakalemljeno. Prikazuje se i kad nema nikoga
(„Trenutno niko ne trenira") — nestanak cijelog polja izgledao bi kao kvar.
Osvježava se na minut, interval se čisti u `ngOnDestroy`.

### 2. Bilješka uz trening

Kolona `note` je stajala neiskorišćena. Ključ je `UNIQUE (user_id, date)`, pa je
bilješka **po danu treninga** — jedna po treningu, ne po vježbi. Vidi se i kad
se dan kasnije ponovo otvori; klik na nju je otvara za izmjenu.

### 3. Offline upis serija

Teretane imaju loš signal. Do sada je pad mreže značio crvenu poruku i
**izgubljenu seriju** — čovjek je odradio set, otkucao brojeve, a aplikacija ih
nije zapamtila nigdje.

Sada takav upis ide u red u `localStorage` i šalje se čim mreža proradi.

Odluke:
- **Odlažu se samo upisi serija.** Brisanje, zamjena vježbe i preređivanje se ne
  odlažu — mijenjaju stanje koje bi se pri kasnijoj sinhronizaciji moglo sudariti
  sa stvarnim stanjem baze, a nisu hitni.
- **Samo pad mreže ide u red.** Odbijanje od baze (prekršeno pravilo) bi se pri
  ponovnom slanju odbilo opet, pa takva greška mora da se vidi odmah.
- **Šalje se jedan po jedan, redom.** `set_number` zavisi od prethodnih serija,
  pa bi paralelno slanje umjelo da ih ispremješta.
- **`localStorage`, ne IndexedDB** — red je mali i piše se jednom po seriji.
- Serija koja čeka ima **isprekidan obrub** i ne može se mijenjati dok ne prođe
  (nema je još u bazi). Traka na vrhu kaže koliko ih čeka.

**Provjereno u pregledaču punim ciklusom:** simuliran pad mreže → serija
upisana, traka se pojavila, obrub isprekidan, red u `localStorage` = 1 → mreža
vraćena → red = 0, red u bazi potvrđen SQL-om.

### Usput

- **Sedmica na rang listi je kalendarska** (pon–ned preko `mondayOfThisWeek`),
  ne „zadnjih 7 dana" — provjereno na traženje.
- **Strelice za mjesec u profilu su radile** (`Jul → Jun → Maj`), ali se to nije
  vidjelo jer se **nijedna brojka nije mijenjala** — sve prate klizni opseg.
  Dodat broj treninga za prikazani mjesec uz naslov („JUL 2026 · 6") i vidljiv
  okvir oko strelica.

**Dodirnuti fajlovi:**
- `src/app/services/offline-queue.service.ts` — nov servis
- `src/app/services/training.service.ts` — `saveNote`, `note` u modelu,
  registracija pošiljaoca za red
- `src/app/services/leaderboard.service.ts` — `getLiveSessions`
- `src/app/components/dashboard/*` — sekcija „Trenira sada"
- `src/app/components/training/*` — bilješka, traka odloženih upisa, `pending`
- `src/app/components/profile/*` — broj treninga uz naslov mjeseca

---

## [2026-07-26] Popravka: grafikon težine bio uvećan tri puta
**Tip:** popravka
**Ref:** —

**Problem:** Poslije prelaska grafikona napretka na stalnu širinu, grafikon
**težine** je postao ogroman — visok skoro kao cijela stranica.

**Uzrok:** pravilo `.progress-chart { width: 100%; height: auto; }` razvlači SVG
na širinu kartice. Grafikon vježbe ima stalnu širinu crteža (`chartSpan = 560`),
pa se skalira otprilike 1:1. Grafikon težine je zadržao **računatu** širinu:

```
weightChartWidth = 62 + 34 + (n − 1) × 70     // za dva upisa = 166 px
```

166 px razvučeno na ~490 px je uvećanje od tri puta — a `height: auto` je isto
toliko uvećalo i visinu, sa 260 na ~770 px.

Nije se primijetilo odmah jer su oba grafikona dijelila isto CSS pravilo, ali
samo je jedan dobio stalnu širinu.

**Rješenje:** i grafikon težine koristi `chartSpan`. Tačke se raspoređuju po
cijeloj širini, skaliranje je 1:1.

**Dodirnuti fajlovi:**
- `src/app/components/profile/profile.component.ts` — `weightChartWidth = this.chartSpan`

---

## [2026-07-26] Modali: `svh` umjesto `vh`, obrazac koji se lomi sam
**Tip:** popravka
**Ref:** —

**Problem:** Na telefonu se modal za upis težine sjekao — vrh ispod zaglavlja,
dno ispod futera — a polja su se preklapala.

**Uzrok 1 — `vh` na telefonu.** Globalna `.modal-card` je imala
`max-height: min(88vh, 900px)`. `vh` je **velika** visina ekrana, onakva kakva
bi bila da je traka sa adresom sakrivena. Otkad stranica ne skroluje (vidi
`app.component.scss`), traka se **nikad** ne sakriva, pa je `88vh` bio viši od
onoga što se stvarno vidi. Modal je zato ispadao izvan vidljivog dijela na oba
kraja.

Ispravljeno na `svh` — mala, stabilna visina ekrana. Isto u biraču vježbe
(`88dvh` → `88svh`, `78vh` → `78svh`).

**Uzrok 2 — obrazac na fiksne tačke prekida.** Bio je mreža `1fr 1fr auto` uz
poseban `@media (max-width: 520px)`. To znači da postoji tačno jedna širina na
kojoj izgleda dobro: mjereno, na 360px se polje za kilažu skupljalo na **56px**
a dugme „Upiši" je **ispadalo iz kartice**.

Zamijenjeno `flex-wrap`-om sa osnovnom širinom po polju (datum `200px`, kilaža
`130px`). Dok ima mjesta stoje u redu, kad nema — prelome se. **Bez ijednog
`@media`.**

**Provjereno mjerenjem** na 300 / 340 / 380 / 500 px: nijedan element ne
prelijeva karticu, polje za kilažu ostaje 152–232px, kartica staje u ekran i
skroluje iznutra kad sadržaj preraste.

**Dodirnuti fajlovi:**
- `src/styles/_base.scss` — `.modal-card` na `svh`
- `src/app/components/shared/exercice-picker/exercice-picker.component.scss` — `svh`
- `src/app/components/profile/profile.component.scss` — `.wm-form` na `flex-wrap`,
  uklonjen `@media`, `.weight-card` više ne postavlja svoju visinu

---

## [2026-07-26] Modali žive u polju između zaglavlja i futera
**Tip:** popravka
**Ref:** —

**Problem:** Sadržaj modala se nije lijepo uklapao — pokušavao je da se rasporedi
na **cijelu visinu ekrana**, iako se zaglavlje i futer nikad ne sklanjaju.
Posljedica na telefonu: vrh kartice ispod zaglavlja, dno ispod futera.

Prethodna popravka (`vh` → `svh`) je smanjila grešku ali je nije uklonila —
i dalje je bila **procjena** visine umjesto stvarne mjere.

**Rješenje:** `.modal-overlay` više nije `inset: 0`, nego:

```scss
top:    calc(var(--header-h) + var(--safe-t));
bottom: calc(var(--footer-h) + var(--safe-b));
```

Kartica onda ima `max-height: 100%` — a 100% je tačno onoliko prostora koliko
ga stvarno ima. Nema više nikakvog `vh`, `svh` ni `dvh` u modalima; nema šta da
se procjenjuje.

Isto važi za birač vježbe (`height: 100%` umjesto `88dvh`) i za rezervu za
sigurnu zonu u dnu kartice, koja je postala suvišna — futer je već izvan polja
modala i sam vodi računa o njoj.

**Izmjereno poslije popravke** (ekran 500×641):

| | od | do |
|---|---|---|
| zaglavlje | 0 | 86 |
| **polje modala** | **86** | **577** |
| kartica | 86 | 577 |
| futer | 577 | 641 |

Kartica ne ulazi ni pod zaglavlje ni pod futer, a skroluje iznutra (sadržaj 665,
okvir 490).

**Napomena:** pregled slika u blogu (`.lb`) namjerno ostaje preko cijelog ekrana
— to je pregledač fotografija, ne obrazac.

**Dodirnuti fajlovi:**
- `src/styles/_base.scss` — `.modal-overlay`, `.modal-card`
- `src/app/components/shared/exercice-picker/exercice-picker.component.scss`

---

## [2026-07-26] Sistemska popravka: sve preko ekrana staje u polje između zaglavlja i futera
**Tip:** popravka
**Ref:** —

**Povod:** iz pregleda slike u blogu se nije moglo izaći na telefonu. Marko je
pretpostavio da je uzrok isti kao ranije sa zaglavljem i futerom — i bio je u
pravu. Zatraženo je da se **provjeri svuda**.

### Nalazi audita

`grep` po svim `position: fixed` slojevima i svim visinama vezanim za ekran:

| Mjesto | Problem |
|---|---|
| `blog` `.lb` | `inset: 0` — dugme za izlaz uz samu ivicu, ispod pregledačeve trake |
| **`dashboard` `.modal-overlay`** | **naslijeđeno lokalno pravilo** (`inset: 0`, `z-index: 1000`, stara pozadina) koje je poništavalo globalno |
| `dashboard` `.modal-card` | isto — `rgba(20,20,20,.9)`, `backdrop-filter`, `width: 400px` |
| `dashboard` `.modal-card-large` | `85vh` / `90vh` |
| `exercices` `.detail-card` | `88vh`, slika `46vh` |
| `landing` | `100vh` |

Zbog lokalnih pravila na dashboardu **modal plana nije pratio nijednu raniju
popravku** — ni prelazak na dizajn sistem, ni ograničavanje na vidljivo polje.

### Urađeno

Sve fiksirano sada koristi isto polje kao modali:
`top: header-h + safe-t`, `bottom: footer-h + safe-b`. Lokalna pravila na
dashboardu su obrisana; izgled dolazi iz globalnog sloja.

**U projektu više nema nijednog golog `vh`** — provjereno `grep`-om.

### Tri zamke sa procentualnom visinom (redom kako su otkrivane)

Slika u pregledu je i dalje prelijevala ekran, u tri koraka:

1. `align-items: center` na `.lb` → red se mjeri po sadržaju, pa `max-height:
   100%` nema prema čemu da se izračuna. → `stretch`.
2. `grid-template-rows` nije bio zadat → implicitni red je `auto`, pa ga slika
   od 1920px razvuče. → `minmax(0, 1fr)`.
3. **`.lb-stage` je i sam bio grid** sa `auto` redom — ista zamka jedan nivo
   niže. → običan blok.

Tek sa sva tri: polje 1008px, slika **1644×928**, staje.

Pravilo koje iz ovoga slijedi: `height: 100%` na djetetu traži **određenu**
visinu roditelja. U gridu to znači i zadan red, ne samo zadanu visinu kontejnera.

### Izlaz iz pregleda

- Dugme X sa 38 na **44px**, sa obrubom i punom podlogom, pomjereno od ivice
- **Povlačenje nadolje zatvara** — jedini izlaz koji ne traži pogađanje dugmeta
- Uputstvo u dnu to i kaže

**Dodirnuti fajlovi:** `blog`, `dashboard`, `exercices`, `landing` (scss),
`blog.component.ts` (pokret nadolje)

---

## [2026-07-26] Modal težine: jednaka polja i čitljiv grafikon na telefonu
**Tip:** popravka
**Ref:** —

**1. Datum je bio šire polje od kilaže.** Imao je osnovnu širinu 200px prema
130px za kilažu, bez razloga — sadržaj mu je kratak. Sada su oba `130px`, pa su
jednaka na svakoj širini (mjereno: 140/140, 185/185, 235/235).

Da bi kraći zapis stao bez skraćivanja, uklonjena je ikona kalendara iz polja
(oznaka „DATUM" je iznad) i **godina se izostavlja kad je tekuća** — u praksi se
upisuje današnji ili jučerašnji dan, pa „2026." samo troši širinu.

**2. Grafikon je na uskom ekranu bio nečitljiv.** SVG se razvlači na širinu
kartice, pa se sa njim skalira i **tekst**. Sa fiksnom koordinatnom mrežom od
560 na uskom telefonu ispadao je odnos **0,46** — natpisi ose od 10px postajali
su 4,6px.

Sada je crtež uži na uskom ekranu (`viewBox` 360 umjesto 560), pa odnos ostaje
blizu jedan. Mjereno na 390px: odnos **0,80**, tekst 8,0px. Sadržaj se ne
mijenja, samo koordinatna mreža. Crtež se ponovo slaže na promjenu širine
prozora.

**Provjereno na 300 / 360 / 430 / 520 / 620 px:** nijedan element ne prelijeva
karticu i nijedan ne nestaje.

**Dodirnuti fajlovi:**
- `src/app/components/profile/profile.component.ts` — `chartSpan` postao getter
  ovisan o širini ekrana, `weightDateLabel`, `@HostListener('window:resize')`
- `src/app/components/profile/profile.component.{html,scss}`

---

## [2026-07-27] Spajanje `main`: R2, dropset, vježbe tjelesnom težinom
**Tip:** infrastruktura / funkcionalnost
**Ref:** —

**Spajanje bez ijednog konflikta.** Filip je prethodno spojio našu granu u `main`
(`a630763`), pa je `origin/main..XFactor` bilo **0 commitova** — spajanje je bilo
pravolinijsko.

### Šta je Filip donio

| Commit | Šta |
|---|---|
| `65f509f r2` | blog media na Cloudflare R2 + edge funkcija `r2-presign` + 2 migracije |
| `ce28fd6 ffmpeg` | izbačena jedna zavisnost, promijenjen `video-compress` |
| `dfd47f6 dropset` | dropset u zasebnoj tabeli + `exercices.is_bodyweight` |
| `185209c summary card` | `max-height: 100%` na kartici rezimea |

Migracije su dobro osmišljene: **dropset ide u zasebnu tabelu** (`dropset_logs`)
umjesto u `exercice_logs`, pa ne kvari `set_number`, rang listu, lični rekord ni
grafikon progresa. Stilovi koje je napisao već koriste naše tokene i pisani su
u istom stilu komentara — nije bilo šta da se prilagođava.

### Vraćeno na naše

`env.ts` je **opet** bio prebačen na cloud, uz komentar u istom fajlu koji kaže
da gađa lokalni Docker. Vraćen na lokalni; `r2PublicUrl` je zadržan jer je nov
i potreban u oba okruženja.

### Popravljeno

**Nijedna vježba nije bila označena kao tjelesna težina.** Migracija
`20260726040000` je dodala kolonu `is_bodyweight`, ali je ostavila sve na
`false` — pa se funkcija nije vidjela nigdje, a zgibovi su i dalje tražili
kilažu. To je bilo baš ono na šta je Filip tražio da obratimo pažnju.

Dodata migracija `20260727010000_mark_bodyweight_exercices.sql` koja označava
zgibove (i, unaprijed, sklekove/propadanja/zgibove pothvatom kad se dodaju).
Označavanje ide **migracijom, ne ručnim upisom** — inače bi svako okruženje
moralo posebno, a prvi `db:reset` bi obrisao trud.

### Provjereno u pregledaču

- **Rezime treninga staje na telefonu.** Simulirano polje 390×694, 375×517 i
  360×430 sa 3 rekorda i 7 redova ishoda — staje u sva tri i skroluje iznutra.
  Ovo je riješila Filipova izmjena; korisnik je nije imao dok nismo spojili.
- **Zgibovi:** polje za kilažu zamijenjeno dugmetom „+ KILAŽA", upis prolazi bez
  kilaže (`weight = 0`), serija se prikazuje kao „1 · 8" bez „kg".
- **Dropset:** upisan ispod working serije kao `↳ 10 kg × 6`, u bazi u
  `dropset_logs` — `exercice_logs` ostaje sa jednim redom, pa rang lista i
  rekordi nisu dirnuti.

Test-podaci (Pull Ups serija, dropset, dodavanje u sesiju) obrisani nakon provjere.

**Napomena:** pet novih migracija čeka na cloudu — vidi `supabase/cloud/README.md`.

---

## [2026-07-27] Dropset prišiven uz seriju; razmak ispred polja za upis
**Tip:** popravka
**Ref:** Roadmap — doradа ekrana treninga

**Problem:** Dvije stvari na ekranu treninga, obje uočene tek pri stvarnom
treningu na telefonu.

Prva: `.log-form` nije imao nijednu gornju marginu, a `.sets` iznad njega ima
svoju donju ivicu. Čim je upisana prva serija, polje za upis sljedeće naliježe
na red sa upisanima — linija uz liniju, bez ijednog piksela razmaka, pa se ne
vidi gdje prestaje istorija a gdje počinje unos.

Druga: dropset se dodavao punim dugmetom „+ Dropset" koje se crtalo **ispod
svake** upisane serije. Sa tri serije to su tri identična dugmeta u istom redu,
širih od samih serija — a dropset se radi rijetko. Red je izgledao kao da je pun
poziva na akciju, i nije se vidjelo šta je odrađeno a šta ponuda.

**Rješenje:** Polje za upis dobilo je `margin-top`.

Za dropset su isprobana dva rješenja. Prvo je akciju sakrilo u red za izmjenu
serije (dodir na seriju → strelica pored sačuvaj/otkaži/obriši). To je uklonilo
gužvu, ali je napravilo goru zamjenu: četiri dugmeta u redu za izmjenu, i nigdje
nagovještaja da se seriju uopšte dodiruje.

Usvojeno je drugo: uz svaku upisanu seriju stoji sitan „+" koji **dijeli okvir
sa njom** — `.set-wrap` drži seriju i njen rep kao jednu pilulu, spojene ivice
bez zaobljenja na spoju. Time se vidi kome „+" pripada, zauzima jedan znak
umjesto cijele pilule, i obojen je kao redni broj serije (`--dust`) pa se čita
kao dio pilule a ne kao poziv. Dodir na brojeve i dalje otvara izmjenu.

**Dodirnuti fajlovi:**
- `src/app/components/training/training.component.html:174` — `.set-wrap` omotač
  oko serije; `*ngIf="!set.editing"` prebačen sa dugmeta na omotač; dodat
  `.set-drop` rep, sakriven dok serija čeka mrežu (`set.pending`) i kad je
  trening završen
- `src/app/components/training/training.component.html` — uklonjeno stalno dugme
  `.set.add-dropset` ispod svake serije
- `src/app/components/training/training.component.ts:533` — `startDropset(set)`,
  otvara formu bez prebacivanja (za razliku od `toggleDropsetForm`, koji ostaje
  za zatvaranje)
- `src/app/components/training/training.component.scss:390` — `.log-form`
  dobio `margin-top: var(--s-3)`
- `src/app/components/training/training.component.scss` — stilovi `.set-wrap` /
  `.set-drop` umjesto `.set.add-dropset`

**Efekat:** Red serija je tiši i kraći, a dropset je vezan za tačno onu seriju
uz koju stoji. Provjereno u pregledaču: spoj serije i repa je 0px, dropset se
upisuje na seriju čiji je „+" pritisnut (serija 1 ostaje netaknuta), a na širini
od 390px se red prelama bez prelivanja i bez cijepanja pilule napola.

**Napomene:** Animacija ulaska (`set-in`) je premještena sa `.set` na `.set-wrap`.
Dok je stajala na obje polovine, `scale(.9)` je stezao samo seriju pa je između
nje i repa zjapila rupa od 7px — polovine moraju dijeliti jedan `transform`.

Dodirna meta „+" je 35×34px. Manje je od preporučenih 44px, ali je izjednačena sa
ostalim pilulama serija na ovom ekranu; povećanje bi rep učinilo krupnijim od
same serije, što je bila poenta da se izbjegne.

---

## [2026-07-27] Dropset kao grana svoje serije; greška o nepostojećoj seriji; skidanje zaostalog service workera
**Tip:** popravka
**Ref:** nastavak unosa od istog dana

**Problem:** Tri stvari, sve uočene pri probanju na telefonu.

1. Upis dropseta na drugu seriju je vraćao sirovu poruku iz baze:
   `insert or update on table "dropset_logs" violates foreign key constraint
   "dropset_logs_exercice_log_id_fkey"`. Reprodukovano u pregledaču: greška je
   doslovno ista kad se red iz `exercice_logs` obriše dok ekran i dalje pokazuje
   tu seriju — dakle rad na dva uređaja istovremeno. Poruka nije bila prevedena,
   a fantomska serija je ostajala na spisku pa je svaki naredni pokušaj padao
   isto.
2. Dropset je bio samo sljedeća stavka u istom `flex-wrap` redu kao i serije.
   Vidjelo se da stoji „negdje iza" svoje serije, ali ne i da joj pripada — a kad
   se red prelomi, umio je da završi ispod tuđe serije.
3. Telefon nije vidio izmjene sa dev servera. Provjereno: `main.js` i preko LAN
   adrese sadrži nov kod, dakle server je bio ispravan.

**Rješenje:**

1. `humanError` prevodi tu grešku; `saveDropset` na nju osvježava ekran, pa
   serija koje nema nestaje sa spiska.
2. Serija i njeni dropsetovi su spakovani u `.set-group` koja ide u **kolonu**.
   Dropset je uvučen za `$branch-indent` i dobija spojnicu — `::before` sa lijevom
   i donjom ivicom i zaobljenim uglom, koja kreće iz razmaka iznad i ulazi u
   sredinu pilule. Ikona `subdirectory_arrow_right` je izbačena iz pilule i iz
   forme: spojnica već kaže isto.
3. `main.ts` u razvoju odjavljuje svaki zatečeni service worker i briše njegov
   keš. `ServiceWorkerModule` je već bio gašen u dev-u (`enabled: !isDevMode()`),
   ali to sprečava samo NOVU registraciju — već registrovan worker nastavlja da
   poslužuje iz keša, pa zahtjev do servera ni ne stigne.

**Dodirnuti fajlovi:**
- `src/app/shared/errors.ts:31` — prevod greške o stranom ključu `dropset_logs`
- `src/app/components/training/training.component.ts` — `saveDropset` na tu
  grešku zatvara formu i zove `reloadAfterSync()`
- `src/app/components/training/training.component.html:171` — `.set-group` oko
  serije, njenog reda za izmjenu, dropsetova i forme za dropset; `<ng-container>`
  zamijenjen `<div>`-om jer grupa sada nosi stil
- `src/app/components/training/training.component.scss:3` — `$branch-indent`
- `src/app/components/training/training.component.scss` — `.set-group` u kolonu,
  spojnica na `.dropset` i `.dropset-form`, `.sets` dobio `align-items: flex-start`
- `src/main.ts` — odjava zaostalog service workera u razvoju

**Efekat:** Dropset vidno visi o svojoj seriji. Provjereno u pregledaču sa tri
serije, dvije sa dropsetovima: uvlačenje je 16px, forma za dropset se uvlači isto
i ne preliva preko reda, a dropsetovi ostaju vidljivi i dok se serija iznad njih
mijenja. Produkcijski build ne nosi kod za odjavu workera (0 pojava u
`dist/gym-app/main.*.js`) — tiče se samo razvoja.

**Napomene:** Odjava workera djeluje tek kad telefon jednom učita nov `main.js`.
Ako je stari worker već zaglavio, prvo učitavanje mora proći ručno: u iOS-u
Podešavanja → Safari → Napredno → Podaci sajtova → ukloniti tu adresu.

Drugi i treći dropset u istoj grupi kače se spojnicom za dropset iznad sebe, a ne
za samu seriju. Za dva-tri dropseta to se čita kao lanac i radi; da ih bude više,
trebalo bi povući jednu neprekidnu okomitu liniju kroz cijelu grupu.

---

## [2026-07-28] Kucanje na iPhoneu bez zumiranja; Enter vodi kroz polja; dev server na LAN adresi
**Tip:** popravka
**Ref:** —

**Problem:** Tri stvari, sve iz stvarne upotrebe na telefonu.

1. **Svako kucanje je zumiralo cijelu aplikaciju.** Safari na iPhoneu sam zumira
   stranicu čim se fokusira polje za unos čiji je tekst manji od 16px — i poslije
   ne vrati zum nazad. Naš osnovni tekst (`--t-base`) je 15px, pa je pod to
   potpadalo bukvalno svako polje u aplikaciji: dodir na kilažu razmakne ekran, i
   korisnik mora ručno da odzumira da bi vidio ostatak stranice. Usred serije.
2. **Enter u polju za kilažu nije radio ništa.** Polja nisu unutar `<form>`, pa
   nema podrazumijevanog slanja — pritisak na Enter je padao u prazno, a od
   kilaže do ponavljanja i do dugmeta Sačuvaj išlo se isključivo dodirom/mišem.
3. **Aplikacija se nije mogla otvoriti sa telefona.** `ng serve` se podrazumijevano
   vezuje samo za `localhost`, pa telefon na istoj Wi-Fi mreži ne dobija ništa na
   LAN adresi. Rješavalo se ručnim zastavicama pri pokretanju, što se gubilo pri
   svakom novom pokretanju — a telefon je primarni uređaj za probanje ovoga.

**Rješenje:**

**1.** Nov token `--t-field-min`: `0px` podrazumijevano, `16px` unutar
`@media (pointer: coarse)`. Svako pravilo koje postavlja veličinu teksta u polju
propušta je kroz `max(..., var(--t-field-min))`. Na mišu `max()` ne podiže ništa
pa se izgled ne mijenja ni za piksel; na dodiru se svako polje diže na 16px i
Safari nema razloga da zumira.

Nije rađeno preko `maximum-scale=1` u viewport meta tagu, iako je to jedna linija
umjesto sedam fajlova: time se gasi i pinch-zoom samom korisniku (a treba mu, npr.
da uveća sliku vježbe), i noviji iOS ga ionako ne poštuje pouzdano.

Zašto je moralo u više fajlova: stilovi komponenti se ubacuju **poslije** globalnih,
pa bi svako pravilo u komponenti koje prosto postavi svoju veličinu pregazilo ono iz
`_base.scss` i to polje bi opet zumiralo. Zato takvo pravilo ne smije da postavi
vrijednost, nego mora da je propusti kroz `max()`. Pravilo za dalje: **kad postavljaš
`font-size` na `input`/`textarea`/`select`, umotaj ga u `max(..., var(--t-field-min))`.**

**2.** `(keydown.enter)` na polja: kilaža → fokus na ponavljanja, ponavljanja →
čuvanje. Ide preko lokalnih referenci u šablonu (`#logReps`, `#editReps`,
`#dropReps`, `#targetReps`), bez ijedne linije u `.ts`. Pokriveni su sva tri
obrasca na ekranu treninga — upis nove serije, izmjena postojeće serije, dropset —
i modal za ciljeve (serije → ponavljanja → čuvanje).

**3.** `serve.options` u `angular.json` dobio `"host": "0.0.0.0"` i
`"allowedHosts": ["all"]`, pa `npm start` bez ikakvih zastavica sluša na svim
mrežnim adresama i prima zahtjev sa LAN adrese.

**Dodirnuti fajlovi:**
- `src/styles/_tokens.scss:65` — nov token `--t-field-min: 0px`, sa komentarom
  zašto postoji i šta se od pravila očekuje
- `src/styles/_tokens.scss:145` — `@media (pointer: coarse)` diže ga na `16px`
- `src/styles/_base.scss:120` — globalno pravilo za `input, textarea, select, button`:
  `font-size: max(var(--t-base), var(--t-field-min))`
- `src/app/components/training/training.component.scss:343` — `.set-edit input`
  (red za izmjenu serije i obrazac za dropset) propušta `--t-sm` kroz `max()`
- `src/app/components/training/training.component.scss:1061` — `.note-box textarea`
  isto
- `src/app/components/dashboard/dashboard.component.scss:269,365,447` — tri pravila
  sa hardkodiranim veličinama (`.form-group input/textarea/select` 0.95rem,
  `.create-day-card select` 0.9rem, `.exercice-picker-inputs input` 0.85rem)
  propuštena kroz `max()`
- `src/app/components/training/training.component.html:217,219` — Enter u redu za
  izmjenu serije
- `src/app/components/training/training.component.html:242,244` — Enter u obrascu
  za dropset
- `src/app/components/training/training.component.html:272,284` — Enter u obrascu
  za upis nove serije
- `src/app/components/training/training.component.html:334,339` — Enter u modalu
  za ciljeve
- `angular.json:91` — `serve.options` dobio `host` i `allowedHosts`

**Efekat:** Na iPhoneu se pri kucanju ekran više ne razmiče — cijela serija se
upiše bez ijednog ručnog odzumiranja. Na računaru se nije promijenilo ništa: ni
jedna veličina teksta, ni jedan raspored, jer `max(x, 0px)` uvijek vrati `x`. Na
tastaturi se serija upisuje bez skidanja ruku: kilaža, Enter, ponavljanja, Enter.
I `npm start` je sada dovoljan da se aplikacija otvori sa telefona na
`http://<IP-računara>:4300`, bez dopisivanja zastavica.

**Napomene:** Enter na iPhoneu praktično ne radi. Polja su u međuvremenu prestala
da budu `type="number"` (vidi naredni unos od istog dana, o numeričkoj tastaturi i
zarezu), ali zaključak ostaje isti: `inputmode="numeric"` i `inputmode="decimal"`
na iPhoneu otvaraju numeričku tastaturu koja **nema** taster za novi red —
dobitak je za računar i iPad, dok na telefonu i dalje ostaje dugme Sačuvaj. Nije
regresija, ali ne treba očekivati da se osjeti baš tamo gdje se najviše kuca.

`--t-field-min` gađa `(pointer: coarse)`, dakle sve dodirne uređaje, ne samo iOS.
Android Chrome ne zumira pri fokusu pa mu 16px u polju nije potrebno; ne smeta —
polja na dodirnim ekranima su ionako veća od teksta u njima.

`"allowedHosts": ["all"]` znači da dev server prima zahtjev sa bilo kojim `Host`
zaglavljem. Za lokalnu mrežu je u redu; tiče se isključivo `serve`, produkcijski
build to ne nosi.

---

## [2026-07-28] Brojčana polja: numerička tastatura na telefonu i prihvatanje zareza
**Tip:** popravka
**Ref:** nastavak unosa od istog dana

**Problem:** Dvije stvari koje su se pokazale u upotrebi, obje sa telefona.

1. **Tastatura.** `type="number"` na iPhoneu otvara punu tastaturu sa slovima, pa
   se za dvocifren broj prvo mora prebacivati na brojeve — usred serije. `inputmode`
   to rješava, ali ga pregledači na `type="number"` ignorišu ili se ponašaju
   različito, pa se na njega nije moglo osloniti.
2. **Zarez — gore i tiho.** `type="number"` **odbacuje** svaki sadržaj koji ne umije
   da pročita kao broj, a zarez u to spada. Kome numerički raspored tastature nudi
   zarez umjesto tačke — što zavisi od regiona telefona — otkuca „85,5" i polje
   ostane **prazno**, bez ijedne poruke. Izgleda kao da aplikacija ne prima unos.
   To se desilo Filipu.

**Rješenje:** Nova direktiva `NumFieldDirective`, standalone, koja je
`ControlValueAccessor` — dakle `[(ngModel)]` i dalje dobija **broj**, pa se u
komponentama ne mijenja nijedna linija logike. Direktiva sama postavlja
`type="text"`, `inputmode` (`decimal` ili `numeric`) i `autocomplete="off"`, da se
to ne može zaboraviti na nekom polju. Zarez i tačka su ravnopravni na ulazu; prikaz
ostaje sa tačkom, kako se broj ispisuje i drugdje u aplikaciji. Druga tačka se
odbacuje, slova se odbacuju, a prazno polje i samo „." daju `null` a ne 0 — jer
komponente razlikuju „nije upisano" od upisane nule (zgibovi bez tega su stvarno
0 kg). Sadržaj polja se prepisuje samo kad se stvarno promijenio, da kursor ne
skače na kraj pri svakom otkucanom znaku.

Upotreba: `<input appNumField />` za kilažu (dozvoljena decimala),
`<input appNumField="integer" />` za ponavljanja, serije i visinu.

Prevedeno je **svih 15 brojčanih polja** u aplikaciji — `type="number"` više ne
postoji nigdje u `src/app`. Uz pretvaranje su uklonjeni `min`, `step` i ručno
upisan `inputmode`, jer na tekstualnom polju ne rade ništa i samo obmanjuju onoga
ko čita šablon.

**Dodirnuti fajlovi:**
- `src/app/shared/num-field.directive.ts` — novo: direktiva sa `clean()` (zarez u
  tačku, izbacivanje svega što nije cifra ili jedina decimalna tačka) i `parse()`
  (prazno → `null`); komentar na vrhu objašnjava zašto se odustalo od `type="number"`
- `src/app/components/training/training.component.html:216,218,241,243,270,282,333,338`
  — osam polja: izmjena serije, dropset, upis nove serije, modal za ciljeve
- `src/app/components/profile/profile.component.html:51,55,367` — visina i težina u
  izmjeni profila, plus polje u modalu za upis težine
- `src/app/components/dashboard/dashboard.component.html:324,325` — ciljne serije i
  ponavljanja u biraču vježbi
- `src/app/components/register/register.component.html:25,30` — težina i visina pri
  registraciji
- `src/app/app.module.ts:18,46` — direktiva je standalone, pa ide u `imports` (za
  komponente pisane u NgModule stilu)
- `src/app/components/register/register.component.ts:8,13` — `register` je standalone
  komponenta, pa direktivu mora uvesti posebno

**Efekat:** Provjereno u pregledaču, na ekranu treninga i u modalu za težinu u
profilu: polje za kilažu je `type="text"` sa `inputmode="decimal"`, polje za
ponavljanja sa `inputmode="numeric"` — dakle telefon otvara numeričku tastaturu
odmah, bez prebacivanja. Unos: „85,5" → 85.5, „85.5" → 85.5, „8,5,7" → 8.57,
„85a" → 85; u polju za ponavljanja „1,2" → 12, jer se separator tu uopšte ne prima.
Upis serije kroz Enter prošao je do kraja — sačuvano 72.5 kg × 9. U profilu „84,3"
→ 84.3. Zarez više nigdje ne guta unos.

**Napomene:** Prikaz namjerno ostaje sa tačkom iako se unos smije kucati zarezom.
Mijenjati ispis na zarez značilo bi dirati i sve ostale prikaze brojeva u
aplikaciji — serije, grafikone, rekorde — a to nije traženo.

Pošto polja više nisu `type="number"`, pregledač na njima ne radi nikakvu svoju
provjeru (`min`, `step`). Granice i dalje provjerava kod u komponentama (npr.
kilaža 0–1000 u `saveLog`), kao i do sada.

---

## [2026-07-28] Duh prošlog treninga sada obuhvata i dropsetove
**Tip:** funkcionalnost
**Ref:** —

**Problem:** Ekran treninga već pokazuje „duh" prošlog treninga — serije koje su
prošli put odrađene stoje blijedo dok se ne ponove, pa se u toku treninga zna
prema čemu se radi. Dropsetovi u tome nisu učestvovali: prošli dropset se nije
vidio nigdje. U teretani se, dakle, za dropset nije imalo prema čemu raditi —
čovjek se morao sjećati sa koliko je kilograma prošli put išao u drop.

**Rješenje:** Tri dijela.

**1. Servis donosi dropsetove uz duh.** `getEcho` sada uz svaku seriju prethodnog
treninga vraća i njene dropsetove. Nov tip `EchoDropset`, a `EchoSet` je dobio
polje `dropsets`.

Dropsetovi se dovlače **zasebnim upitom** (nova privatna metoda
`attachEchoDropsets`), a ne ugniježđenim `select`-om. Razlog: `getEcho` čita
serije za **sve** vježbe dana pa zadržava samo najskoriji datum po vježbi —
ugniježđeni upit bi, dakle, povlačio dropsetove i za sve one treninge koji se
odmah odbacuju. Zato upit sada bira i `id` reda iz `exercice_logs`, i drži se
veza red → duh serije, da bi se dropsetovi poslije zakačili na pravu seriju.

**2. Komponenta zna koliko duhova još stoji.** Nova metoda
`ghostDropsets(ex, setNumber, doneCount)` vraća prošle dropsetove te serije
umanjene za onoliko koliko je danas već upisano — `prev.slice(doneCount)`. To je
ono što daje ponašanje „upisani staje na mjesto duha": kad se upiše prvi dropset,
prvi duh nestaje, a ostali ostaju.

**3. Šablon crta duhove uz obje vrste serija.** Uz svaku današnju seriju, iza
stvarnih dropsetova, crtaju se blijedi duhovi. Serije koje danas još nisu
odrađene više nisu obična pilula nego `.set-group`, pa i njihovi dropsetovi vise
ispod njih sa istom spojnicom kao kod odrađenih serija. Zbog toga se skrivanje
već odrađene serije premjestilo sa same pilule (`.set.ghost.hidden`) na grupu
(`.set-group.hidden`).

**Dodirnuti fajlovi:**
- `src/app/services/training.service.ts:42` — nov tip `EchoDropset`
- `src/app/services/training.service.ts:53` — `EchoSet` dobio `dropsets`
- `src/app/services/training.service.ts:559,563,590,593` — `getEcho` bira i `id`
  reda i drži vezu red → duh serije, pa na kraju zove `attachEchoDropsets`
- `src/app/services/training.service.ts:604` — nova privatna metoda
  `attachEchoDropsets`, sa komentarom zašto ide zasebnim upitom
- `src/app/components/training/training.component.ts:350` — nova
  `ghostDropsets(ex, setNumber, doneCount)`
- `src/app/components/training/training.component.html:242` — duhovi dropsetova
  uz današnju, već upisanu seriju
- `src/app/components/training/training.component.html:267` — duh serije je sada
  `.set-group`, sa svojim dropsetovima ispod
- `src/app/components/training/training.component.scss:325` — skrivanje
  odrađene serije prešlo sa `.set.ghost.hidden` na `.set-group.hidden`
- `src/app/components/training/training.component.scss:405` — nova pravila
  `.set.dropset.ghost`: isprekidan okvir i boja `--echo`, jer duh dropseta mora
  biti bljeđi i od običnog dropseta i od duha serije — stoji odmah uz oba
- `src/app/components/training/training.component.scss:413` — spojnica ka duhu
  koristi `--line` umjesto `--line-strong`, kao grana koja tek čeka

**Efekat:** Provjereno u pregledaču nad napravljenim prošlim treningom (serija 1:
60 kg × 10 sa dva dropseta, 40×8 i 25×6; serija 2: 60 kg × 8 sa jednim
dropsetom, 35×7). Prije ijednog upisa oba duha dropseta vise ispod duha serije 1,
a treći ispod duha serije 2. Poslije upisa serije 1 i **jednog** dropseta
(42 kg × 8) upisani dropset je zamijenio prvi duh i prikazuje se jasno, dok je
drugi duh (25 kg × 6) ostao blijed ispod njega. Duh serije 2 i njen dropset
ostaju netaknuti. Ukratko: u teretani se sada vidi i koliko je bilo u dropu, ne
samo u radnoj seriji.

**Napomene:** `ghostDropsets` se poziva iz šablona, dakle pri svakom ciklusu
provjere promjena. Posao je `find` po nekoliko serija plus `slice`, i isto tako
već rade `echoFor` i `echoPlaceholder` — dosljedno je postojećem kodu. Ali ako se
lista serija ikad znatno poveća, ovo je mjesto koje se prvo osjeti.

---

## [2026-07-28] Upit za duh prošlog treninga dobio granicu
**Tip:** refaktor
**Ref:** —

**Problem:** `getEcho` je bio **jedan** upit sa `.in('exercice_id', [...])` i **bez
ikakve granice**. Takav upit povuče cijelu istoriju korisnika za svih desetak
vježbi tog dana, poređanu po datumu opadajuće, a onda se u pregledaču zadrži samo
najskoriji datum po vježbi i sve ostalo baci.

Odbačeni dio raste zauvijek. Ko vježbu radi jednom sedmično, za godinu ima oko 150
redova po vježbi — dakle oko **1.500 redova povučenih pri svakom otvaranju ekrana
treninga**, da bi se zadržalo tridesetak. Za dvije godine dvostruko, i tako dalje.
Najgore se osjeti tačno tamo gdje se taj ekran i otvara: u teretani, na slaboj
vezi.

Vrijedi naglasiti šta ovo **nije**: ne zavisi od broja korisnika. Upit filtrira po
`user_id`, pa tuđi treninzi u njega ne ulaze — raste samo sopstvena istorija.

**Rješenje:** Nova privatna metoda `lastTrainingSets(userId, exerciceId,
beforeDate)` radi jedan upit **po vježbi**, sa `.limit(ECHO_ROW_LIMIT)` (nova
konstanta, 20). `getEcho` te upite pušta uporedo kroz `Promise.all` i iz svakog
rezultata uzima samo redove čiji je datum jednak datumu prvog reda — a prvi red
je, po redoslijedu, najskoriji trening te vježbe.

Traženi redoslijed je `(user_id, exercice_id, date desc)`, što je tačno ono što
postojeći indeks `exercice_logs_user_exercice_date_idx` već pokriva. U bazu se,
dakle, ne dodaje ništa.

**Zašto ne RPC:** PostgREST ne zna „po jedan najnoviji iz svake grupe" u jednom
upitu — za to bi trebao `DISTINCT ON`, dakle nova migracija koja se mora ručno
pustiti i na cloud. Pošto na cloudu već čeka nekoliko nepuštenih migracija,
izabrano je rješenje koje ne traži ništa novo u bazi. RPC ostaje kao opcija ako
broj uporednih upita ikad zasmeta.

**Dodirnuti fajlovi:**
- `src/app/services/training.service.ts:64` — nova konstanta `ECHO_ROW_LIMIT = 20`,
  sa komentarom šta granica smije da odsiječe
- `src/app/services/training.service.ts:572` — `getEcho` više ne obrađuje jedan
  ravan spisak redova nego rezultate `Promise.all` po vježbi; iz svakog uzima
  redove do prve promjene datuma
- `src/app/services/training.service.ts:627` — nova privatna metoda
  `lastTrainingSets`, sa komentarom koji objašnjava zašto po vježbi i zašto ne RPC

**Efekat:** Provjereno u pregledaču. Napravljena su tri istorijska treninga iste
vježbe — prije 1, 3 i 10 dana, pri čemu onaj od prije jednog dana ima dva dropseta
na prvoj seriji. `getEcho` vraća samo trening od prije jednog dana, sa obje serije
i oba dropseta, a ekran ih ispravno crta kao duhove. Stariji treninzi se više ni
ne prenose. Probni podaci su obrisani.

Za korisnika se ništa ne mijenja u prikazu — mijenja se koliko se čeka da se
prikaz pojavi, i to sve više što istorija bude duža.

**Napomene:** Granica od 20 mora biti veća od broja serija koje neko odradi na
jednoj vježbi u jednom danu. Realno je to do desetak, pa 20 ostavlja prostora. Ko
bi u jednom danu upisao više od 20 serija iste vježbe, duh bi mu pokazao prvih 20
— sam trening je i dalje ispravno upisan, samo se ostatak ne bi vidio kao duh.

Sada je desetak sitnih uporednih upita umjesto jednog velikog. Preko HTTP/2 idu
kroz istu vezu, pa se ne plaća nova veza po upitu; ako se ikad pokaže da je to na
lošoj vezi gore od jednog odgovora, alternativa je RPC iz prethodnog pasusa.

Dropsetovi za duh se i dalje dovlače jednim upitom (`attachEchoDropsets`), i to
samo za serije koje su preživjele izbor — oni, dakle, nikad nisu ni bili
neograničeni.

---

## [2026-07-28] Praćenje lijeve i desne ruke kod jednoručnih vježbi
**Tip:** funkcionalnost
**Ref:** —

**Problem:** Kod vježbi koje se rade jednom rukom — bočno podizanje, koncentracioni
biceps i slične — jedna ruka je gotovo uvijek jača. Do sada je postojao samo
**jedan upis po seriji**, pa se ta razlika nije mogla ni vidjeti ni pratiti kroz
vrijeme: upiše se „10 kg × 12" i tu se izgubi podatak da je lijeva jedva izvukla
deseto ponavljanje, a desna otišla do dvanaestog bez muke.

**Rješenje:** Pet dijelova — baza, prekidač, prikaz, upis i sve ono što je serija
već znala da radi (izmjena, brisanje, poređenje, duhovi, offline red).

**1. Baza.** Nova migracija `20260728000000_unilateral.sql` donosi dvije kolone:

- `exercices.is_unilateral` (boolean, `not null default false`) — da li se vježba
  prati po stranama. Na nivou **vježbe**, ne treninga: ko jednom odluči da bočno
  podizanje radi jednoruko, tako ga radi svaki put.
- `exercice_logs.side` (text, uz `check` ograničenje) — `NULL` = obje ruke
  zajedno (dosadašnje ponašanje i svi postojeći redovi), `'L'` = lijeva,
  `'D'` = desna.

Redni broj serije teče **odvojeno po strani**: L1, L2… i D1, D2… — jer se strana
poredi sa svojom prošlom stranom, a ne sa onim što je u međuvremenu odradila
druga ruka.

Migracija je puštena lokalno. Na cloudu **mora prije deploya ovog koda**, i to je
uslov jači nego kod ranijih migracija: aplikacija od sada šalje `side` pri
**svakom** upisu serije (kod dvoručnih kao `null`), pa bi bez kolone pucao svaki
upis, ne samo jednoručni. Isto važi i za samo otvaranje ekrana treninga, jer se
`is_unilateral` čita u istom upitu kao naziv vježbe. Evidentirano u
`supabase/cloud/README.md`, u tabeli i u pasusu ispod nje.

**2. Prekidač.** U meniju vježbe na ekranu treninga stoji nova stavka
„Prati ruke odvojeno (L/D)" (odnosno „Ne prati ruke odvojeno" kad je uključeno).
Ide kroz novu servisnu metodu `setUnilateral`, dakle trajno je i važi za vježbu.
Kad je uključeno, uz naziv vježbe stoji mala oznaka sa ikonom ruke i tekstom
„L·D", da se na prvi pogled vidi zašto se serije crtaju drugačije.

**3. Prikaz.** Umjesto jednog prelamajućeg reda serija, jednoručna vježba dobija
**dva bloka** — red za L i red za D, svaki sa malom oznakom strane na početku.

Da se markup ne bi duplirao, postojeća grupa serije (pilula + dropsetovi + duhovi
dropsetova + obrazac za dropset) izvučena je u `ng-template` — `#setGroupTpl` za
odrađenu seriju i `#ghostGroupTpl` za duh. Isti šablon se onda crta i u dvoručnom
redu i u blokovima po ruci, kroz `*ngTemplateOutlet`. Sve što grupa serije zna da
radi (izmjena, dropset, duh dropseta) time radi jednako u oba slučaja, i ostaće
tako i pri narednim izmjenama — jer postoji samo jedno mjesto.

Uz to je skrivanje već odrađenih duhova prešlo sa CSS klase (`.set-group.hidden`)
na novu metodu `sideGhosts(ex, side)`, koja vraća samo one duhove te strane koji
danas još nisu ponovljeni. Klasa je obrisana iz stilova.

**4. Upis: jedan unos, dvije serije.** Kod jednoručne vježbe jedan unos u obrascu
pravi **dvije** serije — L pa D, sa istim brojevima; u obrascu uz natpis serije
stoji oznaka „L+D".

Obrazloženje: druga ruka se **uvijek** odradi. Odvojen upis za svaku bi značio
kucanje istog dvaput, na svakoj seriji, do kraja treninga. Ako je desna ipak
uradila drugačije, dodirne se njena pilula i ispravi — to je već postojeća izmjena
serije, ništa novo se za to nije pisalo.

Zamka koja je uhvaćena pri probi i zaslužuje da se zapiše: `accept()` isprazni
polja obrasca poslije prve strane, pa se vrijednosti (`reps`) hvataju u lokalne
konstante **prije** petlje kroz strane. Bez toga upis za desnu ruku pročita `null`
iz već očišćenog obrasca i baza ga odbije.

**5. Sve ostalo što je serija znala.**

- **Offline red.** `QueuedSet` je dobio polje `side`. Kad mreža pukne usred para,
  u red idu **sve strane koje još nisu prošle** — da par ne ostane šepav, sa
  upisanom lijevom i izgubljenom desnom.
- **Brisanje.** Prenumeracija ide **unutar strane** sa koje je obrisano: brisanje
  L2 pomjera L3 u L2 i ne dira nijednu D seriju. Kod dvoručnih je strana `null`,
  pa je to isti posao kao i ranije.
- **Poređenje sa prošlim treningom** (strelice gore/dolje) poredi istu stranu sa
  istom stranom. Prošli **dvoručni** upis (`side` je `null`) važi kao referenca za
  obje ruke — 10 kg × 12 sa obje bučice jeste 10 kg po ruci. Isto pravilo važi i
  za duhove: ako prošli trening nema strane, isti duhovi se pokažu u oba bloka.
- **Brojanje serija.** Nova metoda `doneCount(ex)`: par L+D je **jedna** serija za
  `progressLabel` i `isComplete`. Uzima se jača strana, da brojka ne stane poslije
  ručnog brisanja jedne pilule; parovi ionako nastaju zajedno.
- **Duhovi dropsetova.** `EchoSet` je dobio `side`, a `ghostDropsets` više ne
  prima broj serije i brojač nego cijelu seriju, pa traži duha sa iste strane.

**Dodirnuti fajlovi:**
- `supabase/migrations/20260728000000_unilateral.sql` — nova migracija:
  `exercices.is_unilateral`, `exercice_logs.side` sa `check` ograničenjem i
  komentarima kolona; pisana da se može pustiti i dvaput
- `supabase/cloud/README.md:40` — migracija upisana u tabelu kao nepuštena na
  cloudu, sa pasusom zašto je ovdje redoslijed obavezan (`side` se šalje pri
  svakom upisu, `is_unilateral` se čita pri svakom otvaranju ekrana treninga)
- `src/app/models/models.ts:72` — `ExerciceLog` dobio `side: 'L' | 'D' | null`
- `src/app/services/training.service.ts:20` — `SessionExercice` dobio
  `isUnilateral`
- `src/app/services/training.service.ts:44` — nov tip `Side`
- `src/app/services/training.service.ts:57` — `EchoSet` dobio `side`
- `src/app/services/training.service.ts:99` — pošiljalac iz offline reda prosljeđuje
  `side` u `insertLog`
- `src/app/services/training.service.ts:215,250` — upit za sesiju čita
  `is_unilateral` uz naziv i sliku vježbe, i puni `isUnilateral`
- `src/app/services/training.service.ts:431` — nova metoda `setUnilateral`, sa
  komentarom zašto je na nivou vježbe
- `src/app/services/training.service.ts:449,463,476` — `logSet` i `insertLog`
  primaju neobavezan `side` i upisuju ga (`?? null`)
- `src/app/services/training.service.ts:617,662` — `getEcho` puni `side` u duh
  serije, `lastTrainingSets` bira kolonu `side`
- `src/app/services/offline-queue.service.ts:46` — `QueuedSet` dobio `side`
- `src/app/components/training/training.component.ts:38` — `LoggedSet` dobio `side`
- `src/app/components/training/training.component.ts:88` — `SIDES`, redoslijed
  blokova (L pa D)
- `src/app/components/training/training.component.ts:258` — `compare` prima stranu;
  traži prošlu seriju iste strane, a dvoručnu (`null`) prihvata kao referencu za obje
- `src/app/components/training/training.component.ts:341` — `echoFor` kod
  jednoručnih predlaže lijevu stranu (ili prošli dvoručni upis)
- `src/app/components/training/training.component.ts:351` — nova `setsFor(ex, side)`
- `src/app/components/training/training.component.ts:360` — nova `doneCount(ex)`;
  par L+D je jedna serija, uzima se jača strana
- `src/app/components/training/training.component.ts:366` — `nextSetNumber` ide
  preko `doneCount`
- `src/app/components/training/training.component.ts:377` — nova
  `sideGhosts(ex, side)`, sa pravilom o prošlom dvoručnom treningu
- `src/app/components/training/training.component.ts:386` — nova
  `toggleUnilateral(ex)`
- `src/app/components/training/training.component.ts:407` — `ghostDropsets` prima
  cijelu seriju i traži duha sa iste strane
- `src/app/components/training/training.component.ts:423,428` — `progressLabel` i
  `isComplete` broje preko `doneCount`
- `src/app/components/training/training.component.ts:471` — `saveLog`: strane koje
  se upisuju (`['L','D']` ili `[null]`) i `mkEntry(side)`
- `src/app/components/training/training.component.ts:475` — `reps` u lokalnu
  konstantu **prije** petlje, jer `accept` isprazni obrazac poslije prve strane
- `src/app/components/training/training.component.ts:517,525,531` — offline upis,
  petlja po stranama i pad mreže: u red idu sve strane koje još nisu prošle
- `src/app/components/training/training.component.ts:608` — brisanje prenumeriše
  samo serije iste strane
- `src/app/components/training/training.component.html:118` — oznaka „L·D" uz naziv
  vježbe
- `src/app/components/training/training.component.html:162` — stavka menija
  „Prati ruke odvojeno (L/D)"
- `src/app/components/training/training.component.html:179` — `.sets` dobija klasu
  `split` kod jednoručnih
- `src/app/components/training/training.component.html:186,280` — grupa serije i
  duh serije izvučeni u `#setGroupTpl` i `#ghostGroupTpl`
- `src/app/components/training/training.component.html:298` — dvoručni prikaz: isti
  prelamajući red kao do sada, sada kroz šablone
- `src/app/components/training/training.component.html:308` — jednoručni prikaz:
  serije upisane prije uključivanja praćenja stoje iznad, pa blok po ruci
- `src/app/components/training/training.component.html:331` — oznaka „L+D" uz
  natpis serije u obrascu
- `src/app/components/training/training.component.scss:325` — obrisano
  `.set-group.hidden`; skrivanje odrađenih duhova sada radi `sideGhosts`
- `src/app/components/training/training.component.scss:396` — nova pravila za
  blokove po ruci: `.sets.split` ide u kolonu, `.side-block`, `.side-tag`
  (oznaka poravnata sa prvim redom pilula, ne sa sredinom bloka) i `.side-sets`
  koji se i dalje prelama kao i dvoručni red
- `src/app/components/training/training.component.scss:511,514` — ikona u oznaci
  uz naziv vježbe i `.both-tag` („L+D" u obrascu, isprekidan okvir)

**Efekat:** Provjereno u pregledaču na vježbi Lateral Raises. Praćenje uključeno
iz menija vježbe; jedan unos 10 kg × 12 napravio je L1 i D1, drugi unos L2 i D2, a
progres pokazuje **2/3** — dakle parovi, ne četiri serije. Izmjena D2 na 8
ponavljanja ne dira lijevu stranu. Dropset na L1 radi kao i na svakoj drugoj
seriji. Brisanje L1 prenumerisalo je L2 → L1, dok su D serije ostale netaknute.

Nad jučerašnjim jednoručnim treningom (L: 12 i 10, D: 10 i 8, uz dropset na L1)
duhovi se pokazuju po strani i nestaju kako se koja strana upisuje. Probni podaci
su obrisani; praćenje na Lateral Raises je ostavljeno uključeno u lokalnoj bazi.

**Napomene:** Rang lista i progres **ne razlikuju strane** — jednoručna serija
ulazi kao i svaka druga, jer je kilaža kilaža. Posljedica koju treba znati: brojka
„koliko puta je dignuto" kod jednoručnih vježbi broji svaku ruku posebno. Svjesno
ostavljeno tako.

Ako se praćenje uključi usred dana u kojem već ima dvoručnih upisa, oni ostaju
vidljivi — stoje iznad blokova po ruci, kao serije bez strane.

---

## [2026-07-28] Ispravka: strelice poređenja po strani i poslije osvježavanja
**Tip:** popravka
**Ref:** nastavak unosa o jednoručnim vježbama

**Problem:** Pri učitavanju ekrana (`hydrate`) se `compare` pozivao bez strane,
pa su se L/D serije poredile samo sa prošlim dvoručnim upisima. Pri samom upisu
je radilo ispravno (`accept` stranu prosljeđuje) — greška se vidjela tek nakon
osvježavanja stranice: strelice u odnosu na prošli jednoručni trening nestanu.

**Rješenje:** `compare` u `hydrate` dobija `l.side ?? null`, isto kao pri upisu.

**Dodirnuti fajlovi:**
- `src/app/components/training/training.component.ts` — `hydrate`, poziv `compare`

**Efekat:** Provjereno u pregledaču: juče L1 9 kg / D1 11 kg, danas obje strane
po 10 kg → poslije osvježavanja lijeva pokazuje gore, desna dolje.

---

## [2026-07-28] Jednoručne vježbe: polovine umjesto blokova sa slovima; oznaka pri dodavanju vježbe
**Tip:** popravka
**Ref:** dorada unosa o jednoručnim vježbama, po povratnoj informaciji iz upotrebe

**Problem:** Dvije stvari.

1. Prikaz L/D blokova sa slovom i okomitom crtom na početku reda ocijenjen je
   kao nezgrapan. Traženo: prostor serija podijeljen horizontalnom linijom —
   gornja polovina lijeva ruka, donja desna — serije teku redom kao i inače,
   bez ikakvih slova; prva serija gore odgovara prvoj dolje.
2. Praćenje ruku se moglo uključiti samo iz menija vježbe na treningu. Pri
   DODAVANJU vježbe u katalog nije postojala mogućnost da se odmah označi,
   iako tamo već stoji ista takva oznaka za tjelesnu težinu.

**Rješenje:**

1. `.side-block`/`.side-tag`/`.side-sets` zamijenjeni jednim `.side-half` po
   ruci: puna širina, prelamanje kao kod dvoručnih, a između polovina
   isprekidana linija (`+` selektor). Redoslijed je dogovor: gore lijeva.
   Naziv ruke ostaje u `title` atributu polovine.
2. Forma „Nova vježba" dobila kvačicu „Radi se jednom rukom/nogom — prati se
   lijeva i desna odvojeno", istim putem kao postojeća za tjelesnu težinu:
   `newIsUnilateral` → `addExercice({ isUnilateral })` → `is_unilateral`.

**Dodirnuti fajlovi:**
- `src/app/components/training/training.component.html` — `.side-half` umjesto bloka sa oznakom
- `src/app/components/training/training.component.scss` — stilovi polovina i linije
- `src/app/components/exercices/exercices.component.html` — nova kvačica
- `src/app/components/exercices/exercices.component.ts` — `newIsUnilateral`
- `src/app/services/exercice.service.ts` — `isUnilateral` u `addExercice`
- `src/app/models/models.ts` — `Exercice.is_unilateral`

**Efekat:** Provjereno u pregledaču: dvije polovine sa isprekidanom linijom
između, bez slova; kvačica u formi vidljiva i prosljeđuje vrijednost.

**Napomene:** Migracija nije potrebna — kolona `exercices.is_unilateral` uvedena
je ranije istog dana (`20260728000000_unilateral.sql`).

---

## [2026-07-28] Jednoručne vježbe u dvije kolone sa okomitom linijom; preslikavanje dropseta; redizajn forme za novu vježbu
**Tip:** popravka
**Ref:** zamjenjuje prethodni unos o polovinama sa horizontalnom linijom, po
povratnoj informaciji iz upotrebe istog dana

**Problem:** Četiri stvari, sve iz upotrebe na telefonu.

1. **Podjela je bila u pogrešnom smjeru.** Horizontalna linija (gore lijeva ruka,
   dolje desna) nije ono što je traženo — tražena je **okomita**: lijeva kolona
   lijeva ruka, desna kolona desna, a serije jedna **ispod** druge. Razlog je
   dvostruk: tako se troši manje prostora na telefonu, i dropsetovi se ljepše
   nadovezuju ispod svoje serije nego kad serije teku u red.
2. **Linija nije išla do dna.** Kad jedna kolona ima dropset a druga nema, kolone
   se nijesu rastezale na istu visinu, pa je crta stajala kod kraće kolone.
3. **Forma za izmjenu serije prelazila je preko druge kolone.** U jednom redu je
   široka oko 280px, a kolona je na telefonu oko 145px.
4. **Modal „Nova vježba" je bio van dizajna aplikacije.** Nativno „Choose File"
   dugme, nativne kvačice i mišićne grupe kao raštrkani balončići — jedini ekran
   koji se nije uklapao u ostatak.

**Rješenje:**

**1. Dvije kolone.** `.sets.split` je sada mreža sa dvije kolone
`minmax(0, 1fr)`. Ključno je `align-items: stretch` — `.sets` inače poravnava na
vrh, pa bez toga kolone ostanu različite visine i linija stane kod kraće. Sama
`.side-half` više nije prelamajući red nego **flex kolona**, tako da serije idu
jedna ispod druge. Linija između ruku je `border-left` na drugoj polovini.

Serije upisane **prije** uključivanja praćenja ruku (bez strane) idu u novu
`.side-full` koja se prostire preko obje kolone (`grid-column: 1 / -1`), da ne
upadnu u mrežu kao da pripadaju nečijoj strani.

**2. Da forma stane u kolonu.** Grupa serije je `inline-flex`, pa se širi po
sadržaju i kolona je sama po sebi ne ograničava — otud `.side-half .set-group`
dobija `max-width: 100%`. Uz to `.side-half .set-edit` ima `flex-wrap: wrap`, a
polja `flex: 1 1 52px`: dugmad siđu u novi red, polja podijele širinu kolone.
Provjereno mjerenjem — forma za izmjenu je tačno 145px, koliko i kolona na
ekranu širine 390px.

**3. Dropset se preslikava na drugu ruku.** Postavljeno je pitanje da li da
dropset upisan na jednoj ruci automatski ode i na istu seriju druge — odgovor je
**da**, istim principom kao i upis serije: jedan unos puni obje ruke. `saveDropset`
zato sada prima i vježbu (`saveDropset(ex, set)`); kod jednoručne vježbe poslije
upisa nađe seriju druge ruke sa istim brojem (`setNumber`, suprotna strana, ne
`pending`) i upiše isti dropset i njoj. U formi za dropset stoji oznaka „L+D",
sa objašnjenjem u `title`.

Ista zamka kao kod upisa serije: vrijednosti (`reps`, `weight`) hvataju se u
lokalne konstante **prije** upisa, jer se forma u međuvremenu očisti.

Ako druga ruka nije radila drop, njen se briše jednim dodirom na X — jeftinije
nego kucati isto dvaput na svakoj seriji.

**4. Modal „Nova vježba" u stilu aplikacije.**

- **Slika.** Nativno file polje je sakriveno, a otvara ga `.file-btn` —
  isprekidan okvir, ikona, naziv izabranog fajla i X za uklanjanje. X poziva
  novu metodu `clearPicture`, koja otpušta `objectURL` pregleda i prazni
  `input.value`, da isti fajl može ponovo da se izabere.
- **Osobine.** Kvačice su zamijenjene `.opt-row` redovima: ikona, naziv, kratko
  objašnjenje i kružić stanja desno. Cijeli red je dodirna meta.
- **Mišićne grupe.** Umjesto balončića različitih širina, `.mg-grid` mreža
  jednakih polja (`repeat(auto-fill, minmax(104px, 1fr))`), sa kvačicom na
  izabranom.
- **Dugmad forme** dobila su `.btn-ghost` i `.btn-primary` — postojeće globalne
  klase iz `src/styles/_base.scss`, iste koje koristi ostatak aplikacije.

**Dodirnuti fajlovi:**
- `src/app/components/training/training.component.scss:403` — `.sets.split` je
  mreža sa dvije kolone; komentar zašto je `align-items: stretch` obavezan
- `src/app/components/training/training.component.scss:413` — nova `.side-full`
  preko obje kolone, za serije bez strane
- `src/app/components/training/training.component.scss:421` — `.side-half` je
  sada flex kolona
- `src/app/components/training/training.component.scss:431` — okomita isprekidana
  linija (`border-left` na drugoj polovini)
- `src/app/components/training/training.component.scss:441` — `.side-half
  .set-group { max-width: 100% }`, sa komentarom zašto `inline-flex` inače pobjegne
  iz kolone
- `src/app/components/training/training.component.scss:443,448` — `.set-edit` se
  prelama, polja `flex: 1 1 52px`
- `src/app/components/training/training.component.html:263` — oznaka „L+D" u
  formi za dropset kod jednoručnih
- `src/app/components/training/training.component.html:268,269` — pozivi
  `saveDropset(ex, set)`
- `src/app/components/training/training.component.html:313` — serije bez strane
  omotane u `.side-full`
- `src/app/components/training/training.component.html:322` — komentar uz
  `.side-half` opisuje kolone umjesto polovina
- `src/app/components/training/training.component.ts:656` — `saveDropset` prima i
  vježbu
- `src/app/components/training/training.component.ts:661` — `reps` i `weight` u
  konstante prije upisa
- `src/app/components/training/training.component.ts:680` — `twin`: ista serija
  druge ruke, i preslikan upis dropseta na nju
- `src/app/components/exercices/exercices.component.html:56,57` — sakriveno
  nativno file polje i `.file-btn` koje ga otvara
- `src/app/components/exercices/exercices.component.html:68,75` — `.opt-row`
  redovi umjesto kvačica (tjelesna težina, jednoručno)
- `src/app/components/exercices/exercices.component.html:86` — `.mg-grid` mreža
  mišićnih grupa
- `src/app/components/exercices/exercices.component.html:103,104` — `.btn-ghost`
  i `.btn-primary` na dugmadima forme
- `src/app/components/exercices/exercices.component.ts:103` — nova metoda
  `clearPicture`
- `src/app/components/exercices/exercices.component.scss:175` — stilovi `.file-btn`
- `src/app/components/exercices/exercices.component.scss:203` — stilovi `.opt-row`
- `src/app/components/exercices/exercices.component.scss:238,244` — `.mg-grid` i
  `.mg-tile` umjesto `.muscle-group-picker` i `.muscle-group-chip`

**Efekat:** Provjereno u pregledaču na širini 390px: dvije kolone stoje jedna
pored druge, okomita isprekidana linija ide do dna i kad jedna strana ima dropset
a druga nema, pilule se ne prelivaju, a forma za izmjenu serije staje u svoju
kolonu.

Dropset 15 kg × 6 upisan na L2 istovremeno je upisan i na D2; brisanje pojedinačno
i dalje radi, dakle svaka strana se može ispraviti zasebno.

Modal „Nova vježba" je u stilu ostatka aplikacije — izgled potvrđen na snimku
ekrana.

**Napomene:** Preslikavanje dropseta je odluka koja se lako vraća na „po ruci"
ako se u praksi pokaže da smeta — sav posao je u jednom `if (twin)` bloku u
`saveDropset`.

Ako druga ruka još nema tu seriju (na primjer, ručno je obrisana), dropset se
upisuje samo na stranu na kojoj je pritisnut „+".

---

## [2026-07-28] Doćerivanje ekrana treninga za telefon; bedževi ispod naziva; ikona noge za L/D vježbe za noge
**Tip:** popravka
**Ref:** dorada prethodna dva unosa o jednoručnim vježbama, po upotrebi na telefonu

**Problem:** Pet stvari, sve uočene na telefonu u toku stvarne upotrebe.

1. **Bedževi su gutali naziv vježbe.** Lični rekord i oznaka L/D stajali su u
   istom redu sa nazivom, pa se naziv na telefonu sabijao do te mjere da je od
   njega ostajalo „S…".
2. **Red ispod naziva lomio se usred riječi.** Cilj i „prošli put" nijesu se
   prelamali kao cjeline nego su se sjekli nasred riječi i razvlačili u više
   redova.
3. **Pilula sa strelicom napretka nije stajala u koloni jednoručnih vježbi.**
   Prvi pokušaj — smanjivanje fonta — pokvario je izgled koji je do tada bio
   dobar. Drugi — prelamanje repa za dropset u novi red — odvojio je „+" od
   pilule, a on mora izgledati kao da iz nje izrasta.
4. **Forma za izmjenu serije i za dropset prelamala se u koloni.** Dugmad su
   padala u zaseban red, odvojena od polja za kilažu i ponavljanja.
5. **Kod vježbi za noge pisalo je „ruke".** Oznaka i stavka u meniju govorile su
   o rukama, uz ikonu ruke, i za jednonožne vježbe. Pokušaji da se to riješi
   Material ikonom (čovječuljak koji hoda) i ručno crtanom nogom ocijenjeni su
   kao loši.

**Rješenje:**

**1. Bedževi ispod naziva.** PR bedž i oznaka L/D premješteni su iz reda sa
nazivom u `.exercice-meta` red ispod. Naziv vježbe tako ima cio red za sebe i
ostaje ispisan cijel. U redu sa nazivom ostaju samo oznake „umjesto" i „dodano",
koje su kratke i vezane za sam naziv.

**2. Meta red se prelama po stavkama.** `.exercice-meta` dobija `flex-wrap: wrap`
(uz `row-gap`), a svaka stavka u njemu `white-space: nowrap`. Stavka je time
komad koji ili stane u red ili cio pređe u sljedeći — tekst se više ne lomi
usred riječi.

**3. Pilula pune širine u koloni.** `.side-half .set-wrap` ide na `width: 100%`,
a sama pilula na `flex: 1; min-width: 0`, pa uzima cijelu širinu kolone i može da
se stisne umjesto da iscuri. Sabija se samo prazan prostor: `padding` i razmaci
unutar pilule, i rep za dropset (`.set-drop`). **Tipografija i strelice ostaju
iste kao u dvoručnom redu** — brojevi se ne smanjuju, jer je upravo to bilo ono
što je prvi pokušaj pokvario. Rep i dalje dijeli okvir sa pilulom i nikad se ne
odvaja u zasebno dugme.

**4. Forme u koloni u jednom redu.** `.side-half .set-edit` mijenja `flex-wrap`
sa `wrap` na `nowrap`, polja su elastična (`flex: 1 1 32px`, centriran tekst,
tanji bočni razmak), dugmad uža (26px). Redni broj serije se u koloni ne ispisuje
(`.set-n { display: none }`) — kazuje ga pozicija u koloni. Iz istog razloga
oznaka „L+D" u formi za dropset u koloni ostaje samo u `title` atributu; za tekst
nema mjesta u jednom redu.

**5. Ruke ili noge.** `SessionExercice` dobija polje `isLegs`. Upit sesije sada uz
vježbu povlači i njene mišićne grupe (`exercice_muscle → muscle_group.name`), a
nogom se smatra svaka vježba čija grupa u nazivu sadrži „leg". Kod takvih vježbi
oznaka i meni govore o **nogama** umjesto o rukama, a uz njih stoji silueta noge
umjesto ikone ruke. Ikona je uvezena („Leg", autor Delapouite, game-icons.net,
licenca CC BY 3.0, navedeno u komentaru u šablonu) jer Material set nema samu
nogu, a zamjene koje ima nijesu dobre.

**Dodirnuti fajlovi:**
- `src/app/components/training/training.component.html:108,110` — PR bedž i L/D
  oznaka premješteni u `.exercice-meta`, sa komentarom zašto ne stoje uz naziv
- `src/app/components/training/training.component.html:126` — `title` oznake L/D
  govori o nogama ili rukama, zavisno od `isLegs`
- `src/app/components/training/training.component.html:131` — silueta noge uz
  oznaku, sa navedenim autorom i licencom
- `src/app/components/training/training.component.html:170,172` — ista ikona i
  tekst o nogama u stavci menija `toggleUnilateral`
- `src/app/components/training/training.component.scss:441,446,449` — grupa,
  omotač i pilula uzimaju punu širinu kolone
- `src/app/components/training/training.component.scss:450,456` — zbijeniji
  `padding` i razmaci unutar pilule u koloni, uži redni broj
- `src/app/components/training/training.component.scss:461,462` —
  `.exercice-meta` se prelama, stavke su cjeline
- `src/app/components/training/training.component.scss:464,465` — uži rep za
  dropset
- `src/app/components/training/training.component.scss:470,478,479,487,488` —
  `.set-edit` u jednom redu: `nowrap`, elastična polja, skriven redni broj, uža
  dugmad
- `src/app/components/training/training.component.scss:490` — „L+D" u koloni ide
  samo u `title`
- `src/app/components/training/training.component.scss:573,574` — veličina i boja
  ikone noge, u oznaci i u meniju
- `src/app/services/training.service.ts:23` — novo polje `SessionExercice.isLegs`
- `src/app/services/training.service.ts:218` — upit sesije povlači i mišićne grupe
  vježbe
- `src/app/services/training.service.ts:254` — `isLegs` se izvodi iz naziva grupe

**Efekat:** Provjereno u pregledaču na širini 390px: naziv vježbe je ispisan cio,
meta red se prelama po stavkama a ne usred riječi, pilula sa strelicom i repom za
dropset staje u kolonu bez promjene tipografije, a forma za izmjenu serije i
forma za dropset stoje u jednom redu — potvrđeno poređenjem sredina elemenata.

Ikona noge i tekst „Ne prati noge odvojeno" potvrđeni su na stvarnoj vježbi sa
LEGS grupom, napravljenoj kroz novu formu za dodavanje vježbe. Izgled na telefonu
potvrđen snimkom ekrana.

**Napomene:** Ikona noge je jedina ikona u aplikaciji koja nije iz Material seta.
Ako se ikad uvede lokalni set ikona (stoji na roadmapu uz PWA), i nju prebaciti
tamo, da izvor ikona bude jedan.

`isLegs` se izvodi iz naziva mišićne grupe („leg"), pa grupa nazvana drugačije
(na primjer „quads") ne bi bila prepoznata. Svjesno pojednostavljenje za postojeći
katalog — ako se nazivi grupa prošire, uslov treba zamijeniti spiskom ili
oznakom na samoj grupi.

---

## [2026-07-28] Puna tastatura na upisu serija (zbog Entera); „Trening u toku" sa tajmerom na dashboardu
**Tip:** popravka + funkcionalnost
**Ref:** dorada unosa o brojčanim poljima i Enteru od 28.07.

**Problem:** Dvije stvari.

1. Numerička tastatura na iPhoneu **nema taster Enter**, pa prelazak
   kilaža → Enter → ponavljanja → Enter → sačuvaj na telefonu nije radio —
   a baš tamo se serije i upisuju. Svoju tastaturu nije moguće napraviti
   (tastatura je sistemska), pa je jedino rješenje vratiti punu.
2. Kad se trening započne pa se pređe na drugi ekran, dugme na dashboardu je
   i dalje pozivalo „Započni trening" — kao da se ništa ne dešava.

**Rješenje:**

1. `NumFieldDirective` dobila ulaz `keyboard`: podrazumijevano `numeric`
   (meni sa brojevima), a `text` ostavlja punu tastaturu — jedina ima Enter.
   Svih 8 polja na ekranu treninga koristi `keyboard="text"`; profil,
   registracija i dashboard zadržavaju numerički meni jer tamo Enter tok ne
   postoji. Prihvatanje zareza i tačke ostaje isto (direktiva čisti unos).
2. `getFinishedAt` zamijenjen sa `getSessionTimes` (vraća i `started_at`).
   Dugme na dashboardu ima tri stanja: „Započni trening", „● Trening u toku"
   sa tajmerom koji kuca svake sekunde (`MM:SS`, preko sata `H:MM:SS`), i
   „Trening završen". „U toku" važi po ISTOM pravilu kao „ko trenira sada":
   sesija postoji, nije završena, mlađa od 4 sata.

**Dodirnuti fajlovi:**
- `src/app/shared/num-field.directive.ts` — ulaz `keyboard`
- `src/app/components/training/training.component.html` — `keyboard="text"` na svim poljima
- `src/app/services/training.service.ts` — `getSessionTimes` umjesto `getFinishedAt`
- `src/app/components/dashboard/dashboard.component.ts` — stanje `todayInProgress`, tajmer
- `src/app/components/dashboard/dashboard.component.html` — tri stanja dugmeta
- `src/app/components/dashboard/dashboard.component.scss` — `.start-btn.live`, tačka koja diše

**Efekat:** Provjereno u pregledaču: polja na treningu su `type="text"` bez
`inputmode` (puna tastatura), a dashboard uz aktivnu sesiju pokazuje
„● Trening u toku 1:31:58" i broji uživo, usklađeno sa redom „trenira sada".

**Napomene:** Kompromis je svjestan: puna tastatura traži jedan dodir više za
brojeve, ali omogućava Enter tok koji je tražen; ako se pokaže da smeta,
`keyboard="text"` se skida po polju. Red „trenira sada" kod jednoručnih vježbi
broji svaku ruku kao seriju (L+D = 2) — evidentirano za kasnije usklađivanje.

---

## [2026-07-28] „Trenira sada" broji parove kod jednoručnih vježbi
**Tip:** popravka
**Ref:** napomena iz prethodnog unosa

**Problem:** Red „trenira sada" je brojao redove iz `exercice_logs`, pa se kod
jednoručne vježbe jedna odrađena serija (L+D, dva reda u bazi) vodila kao dvije
— dok ekran treninga i brojka `2/3` broje parove.

**Rješenje:** `getLiveSessions` broji različite ključeve `(vježba, redni broj)`
umjesto redova; strana ne ulazi u ključ, pa L1 i D1 padnu na isti par. Dvoručne
serije imaju svaka svoj redni broj, pa se za njih ništa ne mijenja.

**Dodirnuti fajlovi:**
- `src/app/services/leaderboard.service.ts` — upit povlači i `exercice_id`,
  `set_number`, `side`; brojanje preko skupa ključeva

**Efekat:** Provjereno: par 12kg×3 (L+D) se sada vodi kao „1 serija".

---

## [2026-07-28] Dropset se može mijenjati dodirom, kao serija
**Tip:** funkcionalnost

**Problem:** Dropset se mogao samo obrisati (X), ne i izmijeniti — a kod
jednoručnih vježbi se pri nastanku preslikava na drugu ruku, pa je izmjena
upravo način da se druga strana ispravi kad se razlikovala. Jedini put je bio
obriši-pa-upiši-ponovo.

**Rješenje:** Dodir na pilulu dropseta otvara istu formu kao kod serije
(kg, ponavljanja, sačuvaj/otkaži; Enter prolazi kroz polja). X za brisanje
ostaje na piluli. Izmjena se namjerno NE preslikava na drugu ruku — preslikava
se samo nastanak; izmjena postoji baš da se jedna strana ispravi.

**Dodirnuti fajlovi:**
- `src/app/services/training.service.ts` — `updateDropset`
- `src/app/components/training/training.component.ts` — `startEditDropset`,
  `cancelEditDropset`, `saveEditDropset`; `DropsetEntry` polja za izmjenu
- `src/app/components/training/training.component.html` — pilula je dugme,
  forma za izmjenu u grani dropseta

**Efekat:** Provjereno: dropset 10×5 na lijevoj preslikan na desnu, izmjena
desnog na 8×6 ne dira lijevi; radi i u kolonama jednoručnog prikaza.

---

## [2026-07-30] Spajanje main grane: profile-preview, news, custom tip dana
**Tip:** infrastruktura

**Problem:** Filip je na main dodao pregled profila (klik na avatara u
leaderboardu/headeru/blogu), sekciju novosti sa migracijom, CUSTOM tip dana i
nove ikone aplikacije — a usput opet prebacio `env.ts` na cloud.

**Rješenje:** `origin/main` spojen u XFactor bez konflikata. `env.ts` vraćen na
lokalni Supabase (cloud podaci žive u `env.prod.ts`, koji je dobio Filipov novi
`sb_publishable` ključ). Filipova migracija `custom_day_type` imala je ISTI
vremenski pečat kao naša `unilateral` (obje `20260728000000`), pa ju je
evidencija migracija odbijala kao duplikat verzije — preimenovana u
`20260728020000_custom_day_type.sql`, sadržaj netaknut (idempotentna).
Obje nove migracije primijenjene lokalno; `supabase/cloud/README.md` dopunjen.

**Napomene:** Pouka za ubuduće: pečat migracije mora biti jedinstven u cijelom
folderu, i vrijedi baciti pogled na tuđe pečate prije nego što se svoja migracija
nazove. Usput je saniran i Docker koji je ostao zaglavljen poslije punog diska
(pozadinski proces od 25.07. preživio restart i držao mrtav socket).

---

## [2026-07-30] Pregled profila globalno: jedan modal, zakačka na svakom avataru
**Tip:** refaktor + funkcionalnost
**Ref:** Filipov profile-preview sa main grane

**Problem:** Filipov brzi pregled profila je odličan, ali je svaki ekran koji
ga nudi (leaderboard, blog, dashboard) držao SVOJU kopiju modala i svoj par
open/close metoda — tri kopije istog šablona, a svako novo mjesto sa avatarom
tražilo bi četvrtu. Uz to, u lightboxu bloga ime autora nije nudilo pregled.

**Rješenje:** Novi `ProfilePreviewService` + direktiva `[appProfilePreview]`
(`src/app/shared/profile-preview.directive.ts`). Modal postoji JEDNOM, u ljusci
aplikacije (`app.component.html`), a bilo koji element koji predstavlja
korisnika dobija pregled jednim atributom:

    <div class="avatar" [appProfilePreview]="e.userId">

Direktiva dodaje kursor (klasa `pp-clickable`), zaustavlja propagaciju klika
(avatar često stoji u redu koji ima svoju radnju) i ćuti kad je id prazan.
Postojećih šest mjesta prevedeno na zakačku; lightbox u blogu dobio pregled na
ime autora. Overlay pregleda podignut na z-index 300 — lightbox je na 200, pa
bi se kartica inače otvarala nevidljivo, iza slike.

**Dodirnuti fajlovi:**
- `src/app/shared/profile-preview.directive.ts` — novo: servis + direktiva
- `src/app/app.component.html`/`.ts` — jedini `<app-profile-preview>` u aplikaciji
- `src/app/app.module.ts` — registracija direktive
- `src/app/components/{leaderboard,blog,dashboard}/*` — zakačke umjesto lokalnih
  modala i metoda; uklonjen `previewUserId` iz sve tri komponente
- `src/app/components/profile-preview/profile-preview.component.scss` — z-index
- `src/styles/_base.scss` — `.pp-clickable`

**Efekat:** Provjereno u pregledaču: na leaderboardu 11 zakački, u DOM-u tačno
jedan modal, klik na avatara otvara karticu. Blog je lokalno prazan pa je
lightbox provjeren statički (z-indeksi).

**Napomene:** Pravilo za dalje: novo mjesto sa avatarom = samo atribut, nikakve
metode u komponenti.

---

## [2026-07-30] Istorija treninga — listanje po danima sa dashboarda
**Tip:** funkcionalnost

**Problem:** Nije postojao način da se vidi raniji trening. Dugme „Započni
trening" je znalo samo za danas — sve odrađeno juče ili prije nedjelju dana
stajalo je u bazi, ali iz aplikacije nedostupno.

**Rješenje:** U tri dijela — čitanje sesije po datumu, ekran treninga koji zna
za režim pregleda, i listanje po danima na dashboardu.

**1. `getSessionByDate` u `training.service`.** Javni omotač postojećeg
privatnog `findSession`: vraća sesiju za dati datum BEZ pravljenja nove.
Ključna odluka koju vrijedi zapisati: istorija se čita iz SESIJE tog dana, ne
iz plana. Sesija je snimak — naziv dana, tip i vježbe u tadašnjem redoslijedu —
pa kasnija promjena ili brisanje plana ne mijenja ono što je odrađeno.

**2. Ekran treninga zna režim pregleda.** `?date=YYYY-MM-DD` u adresi, ako je
različit od današnjeg datuma, uključuje `viewOnly`. `todayDate` tada nosi
gledani datum, pa se duhovi, poređenja i lični rekord računaju u odnosu na TAJ
dan — kako je izgledalo tada, ne danas. `isFinished` uključuje `viewOnly`, pa
sve postojeće brave rade same: nema upisa, izmjene serije, ni dropseta.
Dodatno je sakriveno ono što brave ne pokrivaju: zaglavlje sa
Dodaj/Bilješka/Preuredi i dugme „Otvori ponovo" na traci završenog treninga;
`toggleNote` je dobio bravu. Stvarna zamka bio je `queue.onFlushed` — u
pregledu se NE kači, jer bi osvježavanje poslije prolaska reda napravilo sesiju
za gledani datum. U zaglavlju stoji bedž sa datumom, a ako sesije za taj dan
nema: „Tog dana nije bilo treninga."

**3. Dashboard lista dane.** `selectedDate`, strelice ‹ › oko velikog dugmeta
(dan nazad, dan naprijed) i dugme sa datumom u traci koje otvara postojeći
`app-date-picker`. Stanja dugmeta:

1. **danas** — tri postojeća stanja (Započni trening / Trening u toku sa
   tajmerom / Trening završen);
2. **raniji dan sa upisima** — „Pogledaj trening" ili „Završeni trening", vodi
   na `/training?date=...`;
3. **raniji dan bez upisa** — „Nije trenirano", ugašeno;
4. **budući dan** — „Trening koji čeka", ugašeno, tip dana iz plana.

Traka ispod dugmeta za ranije dane čita naziv i tip iz sesije (snimak), a za
danas i buduće dane iz plana. `dayLoadToken` čuva od utrke: pri brzom listanju
strelicama važi samo posljednje traženje.

**Dizajn** (po povratnoj informaciji odmah u toku rada): strelice su bez
okvira — samo volt ševroni koji vise IZVAN širine dugmeta, apsolutno
pozicionirani, sa blagim „diši" pokretom ka strani na koju vode (ugašen uz
`prefers-reduced-motion`). Dugme zadržava tačno širinu bloka (300px) da traka
ispod ostane njegov produžetak. Stanja „istorija" i „ugašeno" koriste ISTI
jezik kao postojeća `done`/`live` stanja: tamna podloga `#070B04`, volt
odnosno utišan tekst.

**Dodirnuti fajlovi:**
- `src/app/services/training.service.ts` — `getSessionByDate`
- `src/app/components/training/training.component.ts` — `viewOnly`, čitanje
  sesije po datumu, brave
- `src/app/components/training/training.component.html`/`.scss` — bedž sa
  datumom, sakriveno zaglavlje i „Otvori ponovo"
- `src/app/components/dashboard/dashboard.component.ts` — `selectedDate`,
  `loadDay`, `shiftDay`, `startLabel`, `startDisabled`, `dayLoadToken`
- `src/app/components/dashboard/dashboard.component.html`/`.scss` — strelice,
  dugme sa datumom, kalendar, stanja velikog dugmeta

**Efekat:** Provjereno u pregledaču nad stvarnim podacima: 30.07. „Započni
trening" (REST po planu); 29.07. „Nije trenirano", ugašeno; 28.07. „Završeni
trening" otvara čitanje — PUSH dan sa bedžom 28.07.2026., serije L/D para i
dropset grana vidljivi, a nijedno dugme za upis, meni, završetak ni ponovno
otvaranje ne postoji u DOM-u; 31.07. „Trening koji čeka" (PULL iz plana),
ugašeno.

**Napomene:** Za dane prije uvođenja tabele `workout_sessions` sesije ne
postoje, pa će stariji datumi pokazati „Nije trenirano" iako u `exercice_logs`
možda ima upisa — svjesno ograničenje, evidentirano kao mogući kasniji fallback
na same upise. Budući dani namjerno ne vode nikud: trening se ne može započeti
unaprijed.

**Dopuna istog dana — rest day:** dugme na rest day ne poziva „Započni trening"
nego kaže „Rest day" (ikona `self_improvement`, ugašeno). Danas i ubuduće se
čita iz plana (tip REST ili bez tipa), za ranije dane iz snimka sesije — i samo
ako sesija postoji; bez nje ostaje „Nije trenirano", jer se bez sesije ne zna
da li je bio odmor. Ako je neko ipak trenirao na rest day, upisi pobjeđuju:
stanja treninga (u toku/završen/pogledaj) imaju prednost nad odmorom. Ekran
treninga ostaje dostupan kroz donju navigaciju, pa se vanredni trening na rest
day i dalje može odraditi.

**Dopuna istog dana — dva doćerivanja po povratnoj informaciji:**

1. „Trening u toku" na dashboardu sada traži i **bar jednu upisanu seriju** —
   isto pravilo kao „ko trenira sada". Sesija nastaje čim se ekran treninga
   otvori, pa je i bacanje pogleda na raspored prikazivalo trening u toku;
   sada otvoren ekran bez upisa nije trening. (`todayInProgress` +
   `dayHasTraining` i za današnji dan.)
2. Sadržaj velikog dugmeta se pri listanju dana više ne mijenja naglo: rađa se
   iznova (`faceKey` + `ngFor` trik) i uklizi iz smjera listanja — nazad
   slijeva, naprijed zdesna — a boje stanja se pretapaju prelazom umjesto
   preskoka. Uz `prefers-reduced-motion` animacija je ugašena. Provjereno i da
   je dugme u SVIM stanjima tačno iste širine (300px), pa strelice uvijek
   stoje na istom mjestu — ranija verzija reda sa strelicama u toku je dugme
   stiskala kad je natpis duži.

**Dopuna istog dana — split-flap natpis i datum-čip:** promjena natpisa na
velikom dugmetu je sada po slovima: stara slova bježe GORE a nova ulaze ODOZDO,
svako sa kašnjenjem od 22 ms po redu; pri listanju unazad kašnjenje teče
obrnutim redom, pa se vidi i smjer. Novi natpis se rađa tek kad podaci dana
stignu (`pendingFace`), pa slova animiraju konačan tekst — bez treptaja
međustanja. Dugme je dobilo `overflow: hidden` da odbjegla slova ne vire, a uz
`prefers-reduced-motion` sve je isključeno. Datum-čip: ikona `calendar_month`
u volt boji, ispisuje se samo dan (`29.`) — mjesec je višak jer kalendar na
klik ionako pokazuje sve.

**Dopuna istog dana — smirivanje animacije dugmeta (četiri ispravke po
povratnim informacijama):**

1. Treptaj cijelog bloka pri pritisku: dugme na tren ostane bez sadržaja, a
   PRAZAN inline-block pomjeri baseline reda pa sve ispod poskoči. `.start-row`
   je sada flex (dugme flex stavka) — izmjereno: traka i visina dugmeta
   nepomični kroz cijelu animaciju.
2. Preklapanje starih i novih slova: stari natpis sada odlazi gore kao JEDAN
   komad (130 ms), a talas po slovima ostaje samo na ulasku, sa baznim ofsetom
   od 170 ms — na brzoj mreži su se ranije pola starog i pola novog teksta
   znali sresti u nečitljiv hibrid, što je bio i uzrok „jerky" utiska pri
   listanju unazad.
3. Ikona stanja (pješčanik, odmor, istorija...) je nestajala u trenutku
   promjene: odlazeći snimak sada nosi i ikonu i tačkicu „u toku"
   (`outFace.icon/dot`), a četiri `*ngIf` ikone svedene na jedan `faceIcon`.
4. Datum-čip: vraćen U TOK (apsolutni je mijenjao visinu trake i pomjerao
   elemente) — traka je mreža `1fr auto 1fr`, čip skroz lijevo, dan i tip
   matematički centrirani, sve u jednoj liniji (poravnanje izmjereno).

---

## [2026-07-30] Spajanje main: Filipov „plan adjust" i zaključavanje navigacije
**Tip:** infrastruktura

**Problem/Rješenje:** Filip je prihvatio naš PR (#5) i dodao `NavLockService`
(strelica nazad zaključana dok je otvorena izmjena na treningu) i dorade
dashboarda. Dva konflikta riješena unijom: konstruktor treninga dobio i njegov
`navLock` i našu `route`; kod `todayInProgress` zadržano naše pravilo „bar
jedna upisana serija" — ono pokriva i njegov uslov za rest day
(`todayCount === 0`), a bolje radi kad neko ipak trenira na rest day.
`env.ts` po običaju vraćen na lokalni Supabase.
## [2026-07-30] Push notifikacije — Firebase Cloud Messaging preko Spring Boot servisa
**Tip:** funkcionalnost
**Ref:** Roadmap 3.4 (D9), ADR-0002

**Problem:** Aplikacija nije imala način da pošalje push notifikaciju korisniku.
PWA infrastruktura (`@angular/service-worker`) je postojala, ali slanje kroz
Firebase Cloud Messaging traži tajni service account ključ koji ne smije da
završi u browseru — direktan poziv iz Angulara ka FCM-u nije bio moguć.

**Rješenje:** Napravljen zaseban Spring Boot servis ("Gym app backend", `dev/`)
koji drži Firebase Admin SDK ključ i izlaže REST endpointe za slanje i za
registraciju FCM tokena. Angular strana: dodat `firebase` (JS SDK) i ručno
registrovan `firebase-messaging-sw.js` na zaseban scope (odvojeno od
`ngsw-worker.js`, da se ne sudare). Poslije logina se traži dozvola, dobija se
FCM token i šalje na backend uz Supabase JWT kao dokaz identiteta; prije
signOut-a se token briše sa backend-a. Backend čuva `user_id ↔ token` u istoj
Supabase Postgres bazi (Hibernate, tabela `device_tokens`), validira Supabase
JWT preko JWKS-a, i briše token automatski kad FCM javi da je nevažeći.
Detalji odluke (zašto Spring Boot umjesto Supabase Edge Function) u ADR-0002.

**Dodirnuti fajlovi:**
- `package.json` — nova zavisnost `firebase`
- `src/environments/env.ts`, `env.prod.ts` — dodato `apiBaseUrl` i `firebase`
  (config + VAPID ključ); `env.prod.ts.apiBaseUrl` je TODO placeholder dok
  backend ne bude javno deployovan
- `src/firebase-messaging-sw.js` — novo: service worker za pozadinske push poruke
- `angular.json` — SW dodat u `build.options.assets`
- `src/app/services/push-notification.service.ts` — novo: `registerForPush()`,
  `unregisterFromPush()`
- `src/app/components/login/login.component.ts` — poziva `registerForPush()`
  poslije uspješnog logina (bez `await`, ne smije usporiti prijavu)
- `src/app/components/footer/footer.component.ts` — poziva
  `unregisterFromPush()` prije `signOut()`

**Efekat:** Nakon logina se traži dozvola za notifikacije; ako se odobri, FCM
token se registruje na backendu vezan za korisnika. Provjereno uživo (pravi
nalog, `localhost:4300` ↔ `localhost:8080`, local Supabase profil): login →
dozvola → FCM token → `POST /api/notifications/register-token` → `Authenticated
token` u backend logu, bez greške. Tri bagova nađena i popravljena usput:

1. `NimbusJwtDecoder.withJwkSetUri(...).build()` po defaultu očekuje RS256;
   Supabase potpisuje sa ES256 (P-256) — trebalo je eksplicitno
   `.jwsAlgorithm(SignatureAlgorithm.ES256)` (`SecurityConfig.java`).
2. Custom audience validator je čitao `aud` preko `getClaimAsString("aud")`,
   što vraća `null` kad Supabase pošalje `aud` kao listu, ne kao plain string —
   zamijenjeno sa `jwt.getAudience().contains("authenticated")`, koje
   normalizuje oba oblika (`SecurityConfig.java`).
3. `getToken()` (Firebase SDK) poziva `PushManager.subscribe()` odmah nakon
   `serviceWorker.register()`, dok je worker još "installing" —
   `AbortError: no active Service Worker`. Dodato čekanje na `statechange`
   događaj do `activated` prije poziva `getToken()` (`push-notification.service.ts`).

**Napomene:** Backend trenutno radi samo lokalno (`localhost:8080`) — deploy
je zasebna, namjerno odložena odluka (vidi ADR-0002, Posljedice). Rad je na
grani `feature/fcm-push-notifications`, ne na `main`.

---

## [2026-07-30] Spajanje main (FCM notifikacije i tajmer pauze) — popravke i prekidač u profilu
**Tip:** infrastruktura + popravka
**Ref:** Filipov ADR-0002 (FCM push preko Spring Boot servisa)

**Problem:** Sa `origin/main` je stiglo Filipovo veliko parče: FCM push
notifikacije preko novog Spring Boot servisa (sada deployovanog na Renderu) i
tajmer pauze između serija. Spajanje je, međutim, donijelo i četiri stvari koje
su morale da se poprave prije nego što se na tome dalje gradi — od kojih je
jedna obarala trening u cjelini. Uz to, notifikacije nisu imale nijedno mjesto
u aplikaciji sa kojeg bi ih korisnik mogao ugasiti.

**Šta je donio main (Filipovo, zadržano kako jeste):**

- Push notifikacije preko FCM-a: `push-notification.service.ts` i
  `firebase-messaging-sw.js` registrovan na SVOM scope-u (odvojeno od
  `ngsw-worker.js`, da se dva service workera ne otimaju o `/`). Token se
  registruje poslije prijave, a odjavljuje prije `signOut()`-a — dok Supabase
  sesija još važi za `Authorization` zaglavlje. Novi paket `firebase` u
  `package.json`.
- Tajmer pauze između serija (`rest-timer.service.ts`): odbrojavanje se zakazuje
  na BACKENDU kao prava push poruka, ne lokalnim `setTimeout`-om — lokalni
  tajmer umre čim se telefon zaključa ili aplikacija zatvori, a push stiže i
  tada. Restartuje se poslije SVAKOG upisa serije, pa je uvijek aktivan tačno
  jedan. UI (prekidač i izbor trajanja) stoji u zaglavlju treninga.
- `ADR-0002-fcm-push-preko-spring-boot.md` — obrazloženje zašto zaseban Spring
  Boot servis umjesto Supabase Edge funkcije.

**Rješenje — nađeni i popravljeni problemi:**

1. **Zaglavlje treninga je bilo obrnuto.** Pri Filipovom rješavanju konflikata
   uslov na `.header-right` je postao `*ngIf="viewOnly"` umjesto `!viewOnly` —
   dakle dugmad Dodaj / Bilješka / Preuredi i cijela grupa tajmera postojali su
   SAMO u pregledu istorije, a nestali sa živog treninga. Posljedica nije
   kozmetička: na custom planu se trening bez dugmeta „Dodaj" ne može ni
   započeti. Vraćeno na `!viewOnly` i provjereno u pregledaču — današnji trening
   ima dugmad i grupu tajmera, pregled istorije nula.
2. **`env.ts` sa main-a je opet gađao cloud, i nije se ni kompajlirao.** Nova
   verzija je izgubila liniju `const host` koju šablonski string koristi, pa je
   build pucao na `TS2304: Cannot find name 'host'`. Vraćen lokalni Supabase i
   `host` linija; Filipov blok sa `firebase` konfiguracijom i `apiBaseUrl`
   zadržan netaknut.
3. **Odjava je tiho preskakala brisanje tokena.** `unregisterFromPush()` je
   radio samo u SESIJI u kojoj je registracija urađena — poslije osvježavanja
   stranice su `messaging` i `registration` bili `null`, pa je metoda izlazila
   na prvom `if`-u iako token u pregledaču i dalje postoji. Rezultat: push bi
   stizao i poslije odjave. Sada se registracija prvo obnovi kroz
   `navigator.serviceWorker.getRegistration(FCM_SW_SCOPE)`, pa se tek onda
   odlučuje ima li šta da se briše.
4. **Token se registrovao samo pri ručnoj prijavi.** Postojana sesija — svako
   osvježavanje stranice, svaki nov dan bez odjave — nikad nije prošla kroz
   `registerForPush()`, pa uređaj ostaje bez notifikacija do sljedeće ručne
   prijave. Dodat `ensureRegistered()`, koji se zove pri svakom pokretanju
   aplikacije iz `app.component.ts`: tih je i ne otvara nikakav prompt, jer radi
   samo ako je dozvola već `granted` i prekidač u aplikaciji uključen.

**Novo — prekidač za notifikacije u profilu:** u profil je dodata sekcija
„Notifikacije" sa prekidačem u aplikaciji (`gymapp.pushEnabled` u
`localStorage`) i tekstom stanja dozvole pregledača ispod njega. Suština je u
tome što se dozvola pregledača, kad je korisnik jednom ODBIJE, više ne može
tražiti iz koda — sajt tu nema drugi potez osim da kaže gdje se pali ručno, i
tekst ispod prekidača upravo to i radi. Pet stanja: uključeno / isključeno u
aplikaciji / blokirano u pregledaču (sa uputstvom) / pregledač će pitati /
nepodržano. `registerForPush()` sada poštuje prekidač, pa gašenje u aplikaciji
znači i brisanje tokena sa backend-a. Provjereno u pregledaču: sekcija se
prikazuje, prekidač mijenja i stanje i tekst, a uključivanje pri dozvoli
`default` otvara pravi prompt pregledača.

**Dodirnuti fajlovi:**
- `src/app/components/training/training.component.html` — `*ngIf="!viewOnly"` na
  `.header-right` (uz komentar zašto, da se pri sljedećem spajanju ne obrne
  opet); `.scss` i `.ts` treninga sa main-a (UI tajmera)
- `src/environments/env.ts` — vraćen `const host` i lokalni Supabase, zadržan
  Filipov `firebase` / `apiBaseUrl` blok; `env.prod.ts` sa main-a
- `src/app/services/push-notification.service.ts` — `enabled`, `permission`,
  `setEnabled()`, `ensureRegistered()`; obnova registracije u
  `unregisterFromPush()`; provjera prekidača u `registerForPush()`
- `src/app/services/rest-timer.service.ts` — Filipov, nije diran
- `src/app/app.component.ts` — `ensureRegistered()` pri pokretanju
- `src/app/components/profile/profile.component.ts` — `togglePush()`,
  `pushStatus`, `pushBusy`
- `src/app/components/profile/profile.component.html` — sekcija „Notifikacije"
- `src/app/components/profile/profile.component.scss` — stil prekidača i sekcije
- `src/firebase-messaging-sw.js`, `angular.json` (SW u `assets`),
  `src/app/components/login/login.component.ts`,
  `src/app/components/footer/footer.component.ts` — sa main-a
- `package.json` / `package-lock.json` — zavisnost `firebase`
- `docs/05-decisions/ADR-0002-fcm-push-preko-spring-boot.md`,
  `docs/05-decisions/README.md`, `docs/04-ROADMAP.md` — sa main-a

**Efekat:** Živi trening je opet upotrebljiv — dugmad i tajmer su tamo gdje im
je mjesto, a pregled istorije ostaje čist. Lokalni build prolazi i aplikacija
opet gleda u lokalni Supabase. Notifikacije se sada drže korisnikovog izbora u
oba smjera: registruju se same pri svakom pokretanju kad su uključene, a gašenje
u profilu ili odjava stvarno brišu token sa backend-a — i poslije osvježavanja
stranice.

**Napomene:**

- **Gdje push uopšte radi.** Chrome, Edge i Firefox na računaru i Androidu — da.
  iOS Safari — samo kao instalirana PWA (Add to Home Screen, iOS 16.4 naviše);
  u običnom tabu ne. U našoj nativnoj Capacitor ljusci (grana `native-app`) web
  push NE radi uopšte, jer `WKWebView` nema Web Push — tamo bi trebale prave
  APNs notifikacije, a to traži plaćeni Apple nalog. Zapisano kao poznato
  ograničenje, ne kao bag.
- **Render na besplatnom tieru spava.** Prvi zahtjev poslije pauze čeka hladan
  start od pedesetak sekundi, pa tajmer za PRVU seriju u treningu može stići
  kasno ili se izgubiti. Svjesno prihvaćeno za sada — evidentirano da se zna
  odakle dolazi, ako se pojavi kao „tajmer ne radi".
- **Spring Boot backend je arhitektonska promjena.** `CLAUDE.md` i dalje tvrdi
  „nema backend servera" — Filipov ADR-0002 novo stanje dokumentuje, ali
  `CLAUDE.md` treba ažurirati u zasebnom prolazu, da ne bude dvije istine.
- **Sudar brojeva ADR-ova.** Filipov ADR nosi broj 0002, isto kao naš ADR o
  nativnoj ljusci na grani `native-app`. Pri spajanju te dvije grane jedan mora
  da se prenumeriše — naš ide na 0003, jer je Filipov već na main-u.
- **Ne pomjerati sistemski sat radi testiranja tajmera.** Pomjeren sat lomi
  Supabase JWT (aplikacija tada masovno „buguje" na mjestima koja nemaju veze sa
  notifikacijama) i ume da ostavi sesije sa budućim datumom u cloud bazi.

**Dopuna istog dana — rest day otvara trening:** dugme na današnji rest day
više NIJE ugašeno — do ekrana treninga se dolazi samo kroz njega, a na rest day
se uvijek može vanredno trenirati („Dodaj" na ekranu treninga). Natpis ostaje
„Rest day", stil utišan ali živ (`.start-btn.rest`), sa opisom u title.
Raniji dani bez upisa i budući dani ostaju ugašeni. Uz to: Enter na prijavi
vodi korisničko ime → lozinka → slanje (isto kroz cijelu registraciju), a
prekidač notifikacija se prikazuje vizuelno isključen kad Notification API ne
postoji (HTTP van localhost-a) — ranije je izgledao zaglavljen na uključeno.

---

## [2026-07-30] Vibracija uz plamen ličnog rekorda
**Tip:** funkcionalnost

**Problem:** Rekord se slavi animacijom i zvukom, a telefon ćuti — na spravi se
često ni ne gleda u ekran u tom trenutku.

**Rješenje:** `prHaptics()` u `src/app/shared/haptics.ts`, pozvana na istom
mjestu gdje kreću plamen i zvuk (`refreshPr`). Tri svijeta, jedan poziv:
nativna ljuska preko `window.Capacitor` globala (pravi haptički motor, radi i
na iPhoneu — bez uvoza @capacitor paketa u web kod), Android Chrome preko
`navigator.vibrate` (obrazac prati animaciju: udar-pauza-udar-pauza-duži udar),
iOS Safari tiho preskoči (nema nijedan API — vibracija tamo stiže tek kroz
ljusku). Provjereno špijunom na `vibrate`: slavlje okida obrazac
`[90,70,90,70,160]`.

**Dodirnuti fajlovi:**
- `src/app/shared/haptics.ts` — novo
- `src/app/components/training/training.component.ts` — poziv u `refreshPr`

**Napomene:** Custom zvuk za push notifikaciju tajmera NIJE moguć na webu —
zvuk sistemske notifikacije bira operativni sistem, sajt tu nema pristup ni uz
kakvu migraciju. Custom zvuk je izvodljiv u nativnoj ljusci (lokalne
notifikacije nose svoj zvučni fajl) — zabilježeno za native-app granu; izbor
zvuka bi tada bio podešavanje po uređaju (localStorage), bez migracije.

---

## [2026-07-30] Tajmer pauze: živo odbrojavanje na ekranu; probna notifikacija u profilu
**Tip:** funkcionalnost

**Problem:** Tajmer je postojao samo kao obećanje — upišeš seriju i ne vidiš
ništa: ni da odbrojavanje teče, ni koliko je ostalo, ni da li će notifikacija
uopšte stići. A prekidač u profilu kaže šta dozvola TVRDI, ne i da li
notifikacije stvarno iskaču.

**Rješenje:**
1. LOKALNO odbrojavanje u `RestTimerService` (`deadline` u memoriji, kreće
   odmah pri upisu serije — i kad je backend nedostupan). U zaglavlju treninga
   se ispisuje „1:47" pa na isteku „pauza gotova" (volt, tri pulsa, skloni se
   sam). Push notifikacija ostaje za zaključan telefon; ovo pokriva „gledam u
   aplikaciju". Sekundni otkucaj u komponenti postoji samo da tjera ciklus
   provjere promjena.
2. Dugme „Probaj" u profilu (vidljivo kad su notifikacije uključene i dozvola
   data): ispali PRAVU notifikaciju kroz service worker — isti put kao
   tajmerske — pa se pristup dokazuje, ne pretpostavlja.
3. Poruka za nepodržano okruženje sada objašnjava i zašto: „treba HTTPS — na
   pravoj adresi aplikacije rade" (dev preko http://IP sa telefona).

**Dodirnuti fajlovi:**
- `src/app/services/rest-timer.service.ts` — deadline, `remainingLabel`, `expired`
- `src/app/components/training/training.component.html/.ts/.scss` — prikaz + otkucaj
- `src/app/services/push-notification.service.ts` — `testNotification()`
- `src/app/components/profile/*` — dugme „Probaj", jasniji status

**Efekat:** Provjereno u pregledaču: odbrojavanje 0:59 → 0:57, na isteku
„pauza gotova" sa pulsom; probna notifikacija stvarno iskočila (granted).

**Dopuna istog dana — tajmer-ostrvo:** rasuti elementi tajmera (dugme, polje,
„min", odbrojavanje) spojeni u JEDNU pilulu u stilu aplikacije. Ugašeno = samo
precrtana ikona; paljenjem se tijelo tečno razvuče (max-width + opružni prelaz
— uzor dynamic island) i pokaže minute; dok pauza teče, tijelo nosi živo
odbrojavanje umjesto minuta; na isteku „pauza gotova" u volt boji sa pulsom.
Zamka za ubuduće: tijelo je flex stavka pa je `min-width: 0` OBAVEZAN — inače
`min-width: auto` pobijedi `max-width: 0` i pilula se nikad ne skupi.

**Dopuna — „mastilo" na tajmer-ostrvu:** paljenje sada ima tri sloja pokreta u
istom taktu: pilula se blago RAZLIJE (squash & stretch — stisne po visini dok
se isteže, pa se slegne), kap volt boje krene iz ikone i razlije se kroz
pilulu pa izblijedi (ink-bloom preko ::after), a broj i „min" izranjaju odozdo
sa razmakom od jednog koraka (isti talas kao na velikom dugmetu). Sve ugašeno
uz prefers-reduced-motion.

**Dopuna — tečnost i pri gašenju i pri startu odbrojavanja:** gašenje ostrva
sada ima obrnutu kap (mastilo se POVUČE nazad u ikonu — `ink-retreat`) i
obrnuti stisak (`island-sip`); CSS ne umije animaciju na uklanjanju klase, pa
kratko stanje `tiClosing` vodi komponenta. Prelaz iz minuta u živo odbrojavanje
(prva upisana serija) dobio isti razliv i kap na `.running` klasi — ranije se
sadržaj samo preklopio u novu funkciju, kao treptaj. Jezik pokreta
(squash & stretch + ink-bloom + talas sadržaja) usvojen kao kućno pravilo za
promjene stanja — referentne implementacije: tajmer-ostrvo i split-flap natpis
na velikom dugmetu.

**Dopuna — kompletan lanac faza tajmera animiran + pravilo trajno zapisano:**
`watchTimerPhase` u komponenti prati faze (mirovanje → odbrojavanje → „pauza
gotova" → povratak na minute) i svaki prelaz dobija svoj pokret: istek = jači
razliv + volt kap (alias keyframes `island-splash-done`/`ink-bloom-done` — CSS
ponovo pokreće animaciju SAMO kad se ime promijeni, pa isti keyframes sa
`.running` klase ne bi odsvirao ništa; zapisano kao zamka), natpis izranja pa
pulsira; povratak = skupljanje + kap unazad, minute ponovo izranjaju. Jezik
pokreta ozvaničen kao kućno pravilo: sekcija u `CLAUDE.md` (obavezna), skill
`.claude/skills/tecne-animacije/SKILL.md` (pun recept i zamke) i sekcija u
`docs/08-KONVENCIJE.md` — dakle prisutno u svakoj sesiji i za svakog
saradnika, ne samo u memoriji alata.

---

## [2026-07-31] Svijetla tema za cijelu aplikaciju
**Tip:** funkcionalnost

**Problem:** Aplikacija je znala samo jedno osvjetljenje — mrak. Ko voli
svijetli interfejs (ili ga jednostavno bolje vidi na dnevnom svjetlu u
teretani) nije imao izbor. Uz to, ispod površine je stajala prepreka: iako je
dizajn sistem odavno na tokenima, kroz `src/` su ostale i zakucane boje —
naslijeđeni `greenyellow`, `white`, sirove `rgba(...)` vrijednosti — koje ne bi
poslušale nikakvu promjenu teme.

**Rješenje:**

1. **Tema je jedan atribut.** Pošto sve boje već žive u `_tokens.scss`, tema je
   svedena na `data-theme` na `<html>`: blok `:root[data-theme='light']` nosi
   kompletnu svijetlu paletu i `color-scheme: light`, pa se svaki ekran
   preslika sam. Novi `ThemeService` pamti izbor u `localStorage`
   (`gymapp.theme`), a isti atribut se postavlja i u `main.ts` PRIJE bootstrapa
   — bez toga bi svijetli korisnik na svakom otvaranju vidio bljesak tamne teme
   dok se Angular podiže. Prekidač „Izgled" je u profilu, klizač sa
   suncem/mjesecom.
2. **Promjena teme se PRETAPA, ne puca.** Po kućnom pravilu o pokretu: klasa
   `theme-anim` stoji na `<html>` oko 420ms i za to vrijeme pali globalni
   prelaz boja (`_base.scss`), pa se aplikacija prelije iz teme u temu. Poslije
   se klasa skine i sve je po starom.
3. **Paleta — podloga kost, kartice bijele.** Svijetla podloga je mliječna
   (`#ECEBE4`), a kartice čisto bijele: kontrast dolazi iz podloge, ne iz
   sjenki. Header i futer su u svijetloj temi NEPROVIDNI i iste boje kao
   podloga — providnost je puštala kartice da prosijavaju kroz njih, pa se
   futer u listanju razlikovao od headera.
4. **Energija ostaje neon.** Neon na bijelom je nečitljiv kao tekst (oko
   1.2:1), ali kao punjenje je identitet aplikacije. Zato je token razdvojen:
   `--volt-fill`/`--volt-fill-soft` (pozadine dugmadi, klizača, traka) ostaju
   neonski u OBJE teme, dok `--volt` u svijetloj postaje živa zasićena zelena
   `#3E9400` za tekst, ikone i ivice.
5. **„Duboka ostrva" ne prate temu.** `--deep`/`--deep-high` su skoro crni u
   obje teme, sa stalnim neonom (`--on-deep`) i stalnim svijetlim tekstom
   (`--on-deep-ice`/`--on-deep-mist`) — traka završenog treninga tako u
   svijetloj temi postaje upečatljivo tamno ostrvo umjesto da izblijedi.
6. **Novi tokeni:** `--volt-hi` (hover neona), `--scrim` (zatamnjenje iza
   modala, svjetlije u svijetloj temi), `--ember-a30`, `--ember-ink`, i meke
   sjenke `--lift-1/2/3` za svijetlu temu — 60% crne bi na svijetlom djelovalo
   kao rupa u stranici.
7. **Pozadinska fotografija ostaje ista slika**, samo pod svijetlim velom
   (93–97%) — tokenizovano kroz `color-mix` sa `--void`, bez novog asseta.
8. **Okvir pregledača.** `theme-color` meta i `manifest.webmanifest` prebačeni
   sa stare Angular plave (`#1976d2`) na vrijednost `--void`; meta se pri svakoj
   promjeni teme prepisuje iz `ThemeService`, pa statusna traka ne ostane u
   jednoj temi dok se sadržaj prelije u drugu.

**Veliko čišćenje:** popisano je i zamijenjeno 147 zakucanih boja kroz cio
`src/` — samo u `dashboard.component.scss` bilo ih je 93 (naslijeđeni
`greenyellow`, `white`, sirove `rgba`). Sve je prešlo na tokene ili
`color-mix` izvedenice; jednokratne stvari idu kroz
`:host-context([data-theme='light'])` override. Poseban slučaj je SVG grafikon
progresa u profilu: atribut `stop-color` ne prima `var()`, pa su prelazi
prešli na CSS klase (`.area-stop.me` / `.area-stop.compare`), dok prozirnost
ostaje na `stop-opacity`. Pregled slika u blogu NAMJERNO ostaje mrak u obje
teme — fotografije se gledaju na crnom — pa tamo stoje sirove vrijednosti sa
komentarom zašto.

**Dotjerivanja po živom pregledu:**
- **Stanja velikog dugmeta na dashboardu** u svijetloj temi su FROSTED GLASS:
  `backdrop-filter: blur(16px) saturate(1.35)`, poluprovidno bijelo staklo sa
  zelenim tintom po stanju i mekom sjenkom. Probani su i tamna ostrva i obični
  prozirni tintovi — staklo daje dubinu bez utiska da je komad tamne teme
  presađen na svijetlu stranicu. Tamna tema zadržava ostrva sa neonom.
- **Prekidači u profilu** su prerađeni: pruga se puni neonom, palac se okreće u
  tamno slovo sa neonskom ikonom (čist kontrast u obje teme, umjesto neona na
  neonu), palac leti oprugom, a kap mastila puca na SVAKI klik — kratku klasu
  `pulse` vodi komponenta, jer CSS ne odsvira animaciju pri skidanju stanja.
- **Tekst i ikone na svijetlom:** `--ice #101923`, `--mist #46596B`, uz `--dust`
  i `--echo` kao svijetle duhove.

**Dodirnuti fajlovi:**
- `src/app/services/theme.service.ts` — NOV: izbor teme, pamćenje, pretapanje,
  osvježavanje `theme-color` mete
- `src/styles/_tokens.scss` — blok svijetle teme, `--volt-fill`, `--volt-hi`,
  `--deep`/`--on-deep`, `--scrim`, `--ember-a30`/`--ember-ink`, `--lift-*`
- `src/styles/_base.scss` — pretapanje teme, svijetli veo preko pozadinske
  fotografije, tokenizovana dugmad/modali/greške
- `src/main.ts` — atribut teme prije bootstrapa
- `src/index.html`, `src/manifest.webmanifest` — `theme_color` i
  `background_color` na `--void`
- `src/app/components/profile/*` — prekidač „Izgled", klase za SVG prelaze,
  prerađeni klizači
- `src/app/components/dashboard/*` — staklena stanja velikog dugmeta i najveći
  dio čišćenja boja
- `src/app/components/training|blog|leaderboard|login|register|landing|exercices|news|profile-preview|header|footer|shared/date-picker` —
  zamjena zakucanih boja tokenima i override-i za svijetlu temu

**Efekat:** Prošeteno kroz obje teme, ekran po ekran: dashboard sa svim
stanjima dugmeta, trening sa tajmerom i trakom završenog treninga, rang lista
sa sedmicom i rekordima, profil sa kalendarom i grafikonom, blog, vježbe. U
svijetloj temi nema ostataka tamne (nema tamnih ostrva koja „vise", nema
nečitljivog neon teksta), a tamna tema je poslije čišćenja bez regresija —
provjereno i piksel-poređenjem boja headera i futera.

**Napomene:**
- `color-mix()` se sada koristi znatno šire (Safari 16.2+ / Chrome 111+). Nije
  nov zahtjev — funkcija je već bila u kodu, prag podrške je nepromijenjen.
- `THEME_COLOR` u `ThemeService` je ručni duplikat vrijednosti `--void`, jer
  `<meta>` ne može čitati CSS varijablu. U kodu stoji komentar da se drži u
  sinhronu sa tokenima.
- `backdrop-filter` na staklenim stanjima je samo za svijetlu temu i samo na
  jednom malom dugmetu; header ga i dalje izbjegava iz razloga performansi
  (zamućenje preko velike površine je ranije kočilo otvaranje menija).

**Dopuna — kap preko cijelog ekrana i ulazi na blogu:**
1. Promjena teme je sada KAP MASTILA preko cijelog ekrana: iz same tačke
   dodira na prekidaču krug u boji NOVE teme se razlije preko stranice
   (Web Animations, poluprečnik do najdaljeg ugla), tema procuri ispod njega
   dok je kap najveća, pa kap izblijedi. Uz `prefers-reduced-motion` (ili bez
   tačke dodira) ostaje samo globalno pretapanje. Sigurnosni tajmer čisti kap
   i ako `onfinish` izostane.
2. Blog dobio ulazne animacije u kućnom jeziku: objave izranjaju odozdo
   talasom (kašnjenje po grupi i objavi), naslovi grupa korak ranije, a i sama
   ploča ulazi — pa i prazan blog diše kao ostatak aplikacije.

---

## [2026-07-31] Vježbe tjelesnom težinom: čip „BW" umjesto jednosmjernog otkrivanja
**Tip:** popravka

**Problem:** Unos bodyweight vježbe (zgibovi, propadanja) radio je samo u jednom
smjeru i na više mjesta tiho nije radio ništa.

1. **Nema povratka na čist BW.** Polje kilaže se otkrivalo dugmetom „+ KILAŽA"
   (`revealWeightInput`) i više se nije moglo skloniti. Ko jednom doda teg,
   ostatak treninga gleda polje koje mu ne treba.
2. **Prefil je upisivao nulu.** `toggleLogForm` je punio `weightInput` iz prošle
   serije bez izuzetka, pa je čista BW vježba dobijala „0" u polju — koja se
   morala brisati rukom prije svake serije, jer polje sa nulom ne izgleda prazno.
3. **Dropset i izmjena serije nisu znali za BW.** Oba upisa su tražila
   `weight != null` bez izuzetka za bodyweight, pa je dugme „sačuvaj" nad
   praznim poljem kilaže tiho ne radilo ništa — bez poruke, bez ikakvog znaka.
4. **BW oznaka se nije mogla dodati.** `exercices.is_bodyweight` se mijenjao
   samo ručno u bazi; u aplikaciji nije postojao put do njega, iako za praćenje
   ruku (`is_unilateral`) put postoji odavno.
5. **Nule su curile u prikaz.** Odrađen dropset se ispisivao kao „0kg × 12", a
   opis prošle serije kao „Prošli put: 0kg × 8".
6. **Čista BW vježba nikad nije mogla dobiti plamen.** Rekord se mjerio isključivo
   kilažom, a kod zgibova je ona uvijek 0 — pa ni 20 zgibova naspram ranijih 8
   nije bilo dostignuće.

**Rješenje:**

1. **Dvosmjerni čip „BW".** Kod bodyweight vježbe uz mjesto za kilažu uvijek
   stoji mali čip. Upaljen (volt ispuna) znači ČIST BW: polje kilaže je skupljeno,
   `weightInput` je `null`, u bazu ide 0. Prigušen znači BW + TEG: polje se
   razlilo pored čipa, sa prefilom iz prošle serije ako ga je bilo. Klik radi u
   OBA smjera, a povratak na čist BW briše `weightInput` — inače bi prefilovani
   teg tiho završio u bazi iako čip kaže da ga nema. Dugme „+ KILAŽA" i
   `revealWeightInput()` su uklonjeni.
2. **Pokret po kućnom jeziku.** Polje se ne uklanja iz DOM-a nego skuplja, da
   prelaz ima animaciju u oba smjera: kap mastila kreće iz čipa (`ink-bloom`) i
   povlači se nazad u njega (`ink-retreat`), slot se razlije pa slegne
   (`island-splash` / `island-sip`), a polje izranja talasom (`ch-rise`) — isti
   keyframes koje već koristi tajmer-ostrvo. Smjer nosi kratko stanje `bwFlip`
   u komponenti, jer CSS ne svira animaciju na uklanjanju klase. Sve se gasi uz
   `prefers-reduced-motion`.
3. **Kilaža i ponavljanja postali su JEDNA flex ćelija** (`.log-fields`) umjesto
   dvije grid kolone. Skupljanje ide kroz `flex-grow` (broj, pa se interpolira
   glatko), a ne kroz `max-width` čiju bi krajnju vrijednost trebalo pogađati;
   ponavljanja tako sama preuzmu oslobođeni prostor, kontinuirano i bez skoka.
4. **„Tjelesna težina" u meniju vježbe**, jedan-na-jedan po uzoru na „Prati ruke
   odvojeno": novi `setBodyweight()` u servisu, uz `setUnilateral`. Time SVAKA
   vježba može naknadno dobiti BW opciju. U zaglavlju reda stoji bedž „BW",
   istim jezikom kao postojeći „L·D".
5. **Isti BW tretman u dropsetu i izmjeni serije.** Prazno polje kilaže znači 0
   (`?? (ex.isBodyweight ? 0 : null)`, isti obrazac kao `saveLog`), placeholder
   je „BW" umjesto „kg", a izmjena BW serije otvara polje PRAZNO umjesto sa
   nulom. Čip tu namjerno NEMA — te forme su pilule uz seriju i ne trpe još
   jedno dugme.
6. **Rekord za čiste BW vježbe.** Novi `getBodyweightBests()` vraća najviše
   ponavljanja odrađenih bez tega prije današnjeg dana. Kad su i današnja i
   ranija najbolja kilaža 0, `hasPr` mjeri ponavljanja; ponašanje kad ima tega
   je netaknuto. Oznaka rekorda, njen opis i sažetak treninga tada pišu
   „12 pon." umjesto „0kg" — kroz jedan izvor istine, `prMetric()`.

**Dodirnuti fajlovi:**
- `src/app/services/training.service.ts:472` — nov `setBodyweight(exerciceId, value)`,
  odmah uz `setUnilateral`, istim stilom
- `src/app/services/training.service.ts:793` — nov `getBodyweightBests()`: najviše
  ponavljanja sa `weight = 0` prije zadatog datuma (prag rekorda za čist BW)
- `src/app/components/training/training.component.ts:73` — novo polje
  `previousBestReps` na `TodayExercice`
- `src/app/components/training/training.component.ts:93` — `showWeightInput`
  dobio novo značenje (stanje čipa, ne jednokratno otkrivanje) + novo `bwFlip`
  za smjer animacije
- `src/app/components/training/training.component.ts:288` — peti paralelni upit
  u `hydrate()`; `prShown` se pamti u mjeri rekorda, ne uvijek u kilaži
- `src/app/components/training/training.component.ts:387` — `prevLabel` piše „BW"
  umjesto „0kg"
- `src/app/components/training/training.component.ts:401` — `hasPr` dobio treći
  argument i granu za čist bodyweight; novi `prMetric()` i `prTitle()`
- `src/app/components/training/training.component.ts:454` — `refreshPr` poredi
  MJERU rekorda, pa plamen padne i kad zgibovi porastu sa 10 na 12
- `src/app/components/training/training.component.ts:581` — `echoPlaceholder` za
  prošlu kilažu 0 vraća „Kilaža", ne „0"
- `src/app/components/training/training.component.ts:549` — nov `toggleBodyweight()`
- `src/app/components/training/training.component.ts:603` — `toggleLogForm` više
  ne prefiluje nulu; nov `toggleBodyweightWeight()` umjesto `revealWeightInput()`
- `src/app/components/training/training.component.ts:757` — `startEditSet(ex, set)`
  otvara BW seriju sa praznim poljem kilaže
- `src/app/components/training/training.component.ts:770`,
  `:856`, `:915`, `:927` — BW izuzetak u `saveEditSet`, `saveDropset`,
  `startEditDropset`, `saveEditDropset`
- `src/app/components/training/training.component.ts:1018` — `records` u sažetku
  nose i jedinicu
- `src/app/components/training/training.component.html:150` — oznaka rekorda kroz
  `prMetric`/`prTitle`; `:162` nov bedž „BW"
- `src/app/components/training/training.component.html:220` — stavka „Tjelesna
  težina" u meniju vježbe
- `src/app/components/training/training.component.html:255`, `:289`, `:309`,
  `:311`, `:319`, `:346` — BW placeholderi, zaštita „0kg ×" na odrađenom
  dropsetu, proslijeđen `ex` u izmjenu serije/dropseta
- `src/app/components/training/training.component.html:423` — forma za upis:
  `.log-fields` + `.weight-slot` sa čipom
- `src/app/components/training/training.component.scss:235` — bedž `.tag.bw`
- `src/app/components/training/training.component.scss:271` — meni vježbe dobio
  sedmu stavku, granica visine podignuta na 440px
- `src/app/components/training/training.component.scss:624` — `.log-form` sa tri
  kolone + nov `.log-fields`
- `src/app/components/training/training.component.scss:680` — `.weight-slot`,
  `.bw-chip` i sve animacije prelaza; `.add-weight-btn` uklonjen
- `src/app/components/training/training.component.scss:199`, `:806` — telefonski
  raspored forme (jedna kolona; polja drži flex, ne grid)

**Efekat:** Zgibovi se upisuju bez ijednog brisanja nule — otvoriš formu, ukucaš
ponavljanja, sačuvaš. Ako je bio i teg, jedan dodir na „BW" ga otvori (sa prošlom
kilažom u polju), a drugi dodir ga vrati. Dropset i izmjena serije rade i sa
praznom kilažom. Svaka vježba može dobiti ili izgubiti BW oznaku iz svog menija.
Nule su nestale iz prikaza, a čist bodyweight konačno može oboriti rekord — po
broju ponavljanja.

**Napomene:**
- Baza nije dirana: konvencija ostaje `exercice_logs.weight = 0` za čist BW, a
  flag `is_bodyweight` i dalje stoji na `exercices` (dakle vrijedi za sve
  korisnike, isto kao `is_unilateral`).
- Početno stanje forme i dalje čita ECHO (prošli trening), ne prethodnu današnju
  seriju — nepromijenjeno ponašanje, samo sada bez upisane nule.
- `getBodyweightBests` je zaseban upit umjesto proširenja `getPersonalBests`,
  da postojeći prag rekorda ostane netaknut.

---

## [2026-07-31] Status treninga: pošten started_at, grace za zagrijavanje, živo osvježavanje
**Tip:** popravka (regresija)

**Problem:** `workout_sessions.started_at` nastaje `default now()` pri PRVOM
otvaranju ekrana treninga za taj datum i nikad se ne ispravlja — jučerašnje
listanje rasporeda ostavi pečat od juče (provjereno na produkcijskim podacima:
sesija za petak sa started_at od četvrtka 17:03). Uz uslov „bar jedna serija"
(commit ceea517) status „Trening u toku" se gasio baš na početku treninga, 4h
prozor od lažnog starta gasio ga do kraja dana, tajmer je zbog toga brojao
glupost, dashboard se nije osvježavao dok je otvoren, a „Trenira sada" je
nestajalo i kad pukne učitavanje planova.

**Rješenje:** Sat se resetuje kad trening STVARNO počne, a status dobija grace
prozor od 30 minuta (`WARMUP_GRACE_MIN`, zajednička konstanta) — prisustvo se
računa i bez serija prvih pola sata od poštenog starta (svlačionica +
zagrijavanje); poslije toga bez ijedne serije status se sam gasi, jer
zavirivanje nije trening. Bez migracija — postojeća šema.

**Dodirnuti fajlovi:**
- `src/app/shared/warmup-grace.ts` — NOVO: `WARMUP_GRACE_MIN = 30` sa
  obrazloženjem; jedna istina za sva tri mjesta koja je koriste. Tu je preseljen
  i 4h živi prozor (`LIVE_WINDOW_H = 4`, ranije lokalni `LIVE_MAX_HOURS` u
  leaderboard servisu) — ista granica za „Trenira sada", dashboard dugme i
  reset sata pri „Otvori ponovo"
- `src/app/services/training.service.ts:422` — `restartSessionClock(sessionId)`:
  `update workout_sessions set started_at = now()` (isti stil kao
  `finishSession`)
- `src/app/components/training/training.component.ts:276` — poziv poslije
  `hydrate()` u ngOnInit; `:295` nova `restartClockIfStale()`: živa sesija
  (ne viewOnly, ne završena) sa 0 upisanih serija i satom starijim od 30 min
  → reset sata + lokalni `session.startedAt`; try/catch tiho, ne obara ekran;
  `:1163` „Otvori ponovo" (`reopenTraining`): ako je start ispao iz 4h živog
  prozora, sat se vraća na sada — ponovno otvoren trening opet živi na
  dashboardu i u „Trenira sada" (sesija već ima serije, pa sets>0 prolazi);
  start mlađi od 4h se NE dira — „zaboravio sam jednu seriju" odmah po
  zatvaranju nastavlja od pravog početka, rezime ostaje istinit
- `src/app/components/dashboard/dashboard.component.ts:12` — import konstante;
  `:187` postojeći 60s `liveTimer` tik sada zove i `refreshDayStatus()`
  (`loadLive()` se i ranije zvao odmah u ngOnInit, to je ostalo); `:301` nova
  `refreshDayStatus()`: tiho osvježi started/finished/serije za DANAS bez
  `loadDay()`-evog resetovanja trake, a promjenu natpisa protjera kroz
  postojeći split-flap tok (outFace + faceKey — mehanizam nije diran); `:372`
  komentar u `isRestSelected` (grace stiže kroz `todayInProgress`); `:483`
  `todayInProgress` = nije završen ∧ ima start ∧ start < 4h ∧ (ima serija ∨
  start < 30 min)
- `src/app/services/leaderboard.service.ts:90` — `LiveSession.warmingUp`;
  `:343` getLiveSessions: sesija bez serija ulazi ako je start mlađi od 30 min
  (`warmingUp: true`); sa serijama nepromijenjeno (4h prozor); lokalni
  `LIVE_MAX_HOURS` zamijenjen zajedničkim `LIVE_WINDOW_H`
- `src/app/components/dashboard/dashboard.component.html:125` — sekcija
  „Trenira sada" visi samo na `!loading`, ne više i na `errorMessage`; `:145`
  red za `warmingUp` piše „zagrijava se" umjesto broja serija — dva `*ngIf`-a
  da se pri prvoj seriji span rodi iznova i prelaz odsvira
- `src/app/components/dashboard/dashboard.component.scss:1588` — `.live-sets`
  dobio postojeću `live-in` ulaznu animaciju (prelaz „zagrijava se" → broj) i
  `.warming` varijantu (italic, ista paleta); ugašeno uz
  `prefers-reduced-motion`

**Efekat:** Ulazak u teretanu odmah pali „Trening u toku" (i na rest day) i
tajmer koji broji od stvarnog dolaska; jučerašnje/jutarnje zavirivanje više ne
truje ni tajmer ni „Trenira sada"; ko otvori trening pa ništa ne upiše, nestaje
sa oba mjesta poslije 30 min; dashboard prati promjene i dok stoji otvoren
(60s); „Trenira sada" preživi grešku planova. „Otvori ponovo" na davno
završenom treningu vraća živi status: dugme opet „Trening u toku" sa tajmerom,
korisnik opet u „Trenira sada" — a `todayFinished` padne pri prvom sljedećem
osvježavanju (60s tik `refreshDayStatus`, ili `loadDay` pri povratku na ekran;
nema keša — `getSessionTimes` uvijek čita bazu).

**Napomene:**
- `exercice_logs` nema kolonu vremena, pa se „vrijeme posljednje serije" ne
  može koristiti — zato sva logika ide preko poštenog `started_at`.
- Reset sata namjerno gleda samo serije VIDLJIVE na ekranu (preko učitanih
  vježbi sesije) — isti skup koji korisnik vidi.

---

## [2026-07-31] Merge Filipovih data-only push poruka + paritet šeme (device_tokens)
**Tip:** merge + dokumentacija

Sa main-a povučena dva Filipova commita koja su notifikacije konačno dovela u
red na telefonima, plus izvedena analiza njegovih izmjena van repoa:

1. **Data-only FCM poruke** (`b023e2d`, `c52f9a6`): backend
   (`NotificationServiceImpl.dataOf()`) šalje poruke BEZ `notification`
   payload-a — samo `data`. Razlog: sa `notification` poljem browser sam
   prikaže notifikaciju UZ ručni `showNotification()` iz aplikacije, pa
   korisnik dobije istu poruku dvaput. `onMessage`
   (`push-notification.service.ts:122`) i `onBackgroundMessage`
   (`firebase-messaging-sw.js`) sada čitaju `payload.data`, uz novo `image`
   polje (`assets/noti.jpeg`).
2. **Nova tabela u cloud bazi: `device_tokens`** (id, user_id, token,
   created_at, updated_at) — backend u nju upisuje FCM tokene
   (`/api/notifications/register-token`). Nastala direktno u cloudu, bez
   migracije u repou → dodana rekonstrukcija
   `supabase/migrations/20260731000000_device_tokens.sql` radi pariteta
   lokalne šeme (frontend tabelu ne dira). ⚠️ U produkciji je tabela čitljiva
   publishable ključem — tuđi FCM tokeni izloženi; zabilježeno za Fazu 5
   (sigurnost), nije popravljano.
3. **`supabase/cloud/README.md`** — statusi migracija ažurirani po stvarnom
   stanju clouda (REST provjere 31.07.): workout_sessions, bodyweight,
   unilateral i news su primijenjene.

---

## [2026-07-31] Gradirane vibracije napretka
**Tip:** funkcija

Vibracija je dosad postojala samo za rekord i bila prekratka/pretiha na
telefonu (Markova primjedba iz teretane). Sada tri jačine, po veličini
trenutka (`src/app/shared/haptics.ts` — `progressHaptics(tier)`):

- **'reps'** — više ponavljanja nego prošli put: kratak tap (Light impact / 45ms).
- **'weight'** — veća kilaža nego prošli put: dva srednja udarca (~300ms).
- **'record'** — novi lični rekord: kreščendo od tri teška udarca + dugi zvon
  (~1.2s), prati animaciju plamena; u nativnoj ljusci ide kroz Capacitor
  Haptics (radi i na iPhoneu), na webu `navigator.vibrate`.

Okidanje u `saveLog` (`training.component.ts` — `buzzProgress()`): jednom po
upisu (ne po L/D strani), poređenje sa istom serijom prošlog treninga
(`compare`); rekord ima prednost (vibrira iz `refreshPr` uz plamen, manje se
tada preskaču). Bez poređenja (prvi put) — bez vibracije.

---

## [2026-07-31] Istorija treninga se crta po PODACIMA, ne po današnjem flagu
**Tip:** popravka

**Problem:** `exercices.is_unilateral` i `exercices.is_bodyweight` su GLOBALNI
katalog-flagovi — pale se i gase kroz meni vježbe, za sve korisnike odjednom.
Ekran treninga je po njima crtao SVE: raspored serija, bedževe, duhove,
poređenja, brojanje i sažetak. Snimak dana (`session_exercices`) flagove ne
čuva, pa je promjena flaga retroaktivno prepisivala istoriju: dan odrađen
dvoručno se poslije paljenja L/D prikazivao kao dvije prazne kolone pune
duhova, brojač serija se udvostručavao ili zamrzavao, a numeracija je pravila
rupe i duplikate. Istinu nose same serije — `exercice_logs.side` kaže je li se
strana pratila, kilaža 0 da je serija odrađena tjelesnom težinom.

**Rješenje:** uvedena su izvedena stanja dana (`dayHasSides`,
`dayHasBodyweight`, `echoHasSides`), jedan getter `splitLayout(ex)` kao jedini
izvor istine o rasporedu, jedno pravilo brojanja (broj različitih `set_number`
vrijednosti) i simetrični fallbackovi za duhove i poređenja („pravilo slabije
strane").

### Ključni podslučajevi — prije i poslije

| Slučaj | Prije | Poslije |
|---|---|---|
| Istorija dvoručnog dana, L/D flag danas UPALJEN | dvije prazne kolone sa duhovima, dvoručne serije stisnute u `.side-full` | jedan red, tačno kako je dan rađen |
| Istorija L/D dana, flag danas UGAŠEN | sve serije u jednom redu, L i D jedna do druge bez oznake | dvije kolone — dan JESTE rađen po stranama |
| Brojač poslije gašenja flaga (A4) | par L+D brojan kao dvije serije → „6/3" | par je jedna serija → „3/3" |
| Numeracija poslije gašenja usred dana (A6) | `doneCount + 1` preskoči na 5 → rupa u brojevima | `max(set_number) + 1` → numeracija teče dalje |
| Paljenje flaga usred dana (B2) | brojač zamrznut na „4" zauvijek → duplikati istog `set_number` | par L5/D5, pa L6/D6 — numeracija ide dalje |
| Danas dvoručno, prošli dan L/D | nijedan duh, nijedna strelica (`compare` nije našao red) | duh i poređenje po slabijoj strani |
| Danas L/D, prošli dan dvoručni | radilo | i dalje radi — nije dirano |
| Bedževi „L·D" / „BW" u istoriji | po katalogu — bedž na danu koji tako nije rađen | po tragu u danu (strane u serijama, kilaža 0) |
| Izmjena stare BW serije poslije gašenja flaga | polje se otvara sa „0", placeholder „kg", prazno polje tiho odbija upis | prazan prefil, placeholder „BW", prazno polje čuva 0 |
| BW rekord po ponavljanjima kod vježbe rađene i sa tegom | uslov `previousBest === 0` gutao svaki takav rekord | rekord pada; bez ranijeg BW upisa i dalje nema rekorda |
| Kalendar u profilu | jednoručni dan brojan dvostruko | broje se parovi `exercice_id#set_number` |

### Pravilo slabije strane

Kad se današnja DVORUČNA serija poredi sa danom rađenim po stranama, nema
jednog reda za poređenje nego dva. Uzima se **slabiji: manja kilaža, a pri
istoj kilaži manje ponavljanja.** Duh je cilj koji treba dostići, a poređenje
presuda: jača ruka nije mjera dvoručne serije (10 kg po ruci nije 10 kg sa
obje), pa bi po njoj svaki dvoručni dan ispao nazadak. Slabija strana je ono
što je sigurno odrađeno — presuda ostaje poštena, a cilj dostižan. Isto pravilo
važi za duhove serija, duhove dropsetova, prefil forme (`echoFor`) i ocjenu
para u sažetku.

### Jedno pravilo brojanja

Serija je jedan `set_number`, ne jedan red u bazi. Par L+D su dva reda a JEDNA
odrađena serija; pošto se praćenje ruku pali i gasi usred dana, dan zna imati i
dvoručnih i jednoručnih redova — jedno pravilo pokriva sve. Sljedeći redni broj
je `max(set_number) + 1` (ne „broj odrađenih + 1"), pa promjena flaga usred
dana ne može napraviti ni duplikat ni rupu. Isti ključ (vježba, redni broj)
sada broji serije na sva tri mjesta: ekran treninga, kalendar profila i rang
lista (`LeaderboardService.getLiveSessions:327`).

**Dodirnuti fajlovi:**
- `training.component.ts:62-103` — `TodayExercice` dobio `dayHasSides`,
  `dayHasBodyweight`, `echoHasSides`, `layoutFlow`
- `training.component.ts:385-388` — `hydrate` računa izvedena stanja iz upisanih
  serija i iz echa
- `training.component.ts:420-423` — `refreshDerived(ex)`, zove se iz upisa
  (`:946`), izmjene (`:1038`), brisanja (`:1074`) i oba toggle-a (`:744`, `:786`)
- `training.component.ts:436-438` — `splitLayout(ex)`: u istoriji/završenom
  treningu isključivo `dayHasSides`, na živom `dayHasSides || isUnilateral`
- `training.component.ts:444-451` — `showSidesBadge` / `showBwBadge`
- `training.component.ts:460-468` — `echoHint(ex)`: opis uz datum prošlog
  treninga kad duh dolazi iz drugačijeg rasporeda (jedini čitalac `echoHasSides`)
- `training.component.ts:479-481` — `bwField(ex, weight)`: BW tretman i po flagu
  i po samom redu (kilaža 0)
- `training.component.ts:495-528` — `weakerSet` + `echoSetIn`: jedno mjesto za
  oba nesimetrična slučaja (prošli dvoručni red važi za obje ruke; prošli L/D
  par se svodi na slabiju stranu)
- `training.component.ts:544` — `compare` ide kroz `echoSetIn`
- `training.component.ts:594` — `hasPr`: uklonjen uslov `previousBest === 0`
- `training.component.ts:675-676` — `echoFor` bira stranu po `splitLayout`
  (ranije „prvi red iz niza" — nedeterministički kad je prošli dan bio L/D)
- `training.component.ts:696-717` — `setNumbers` / `doneCount` / `nextSetNumber`
- `training.component.ts:724-731` — `sideGhosts` kroz `echoSetIn`
- `training.component.ts:757-767` — `flowLayout`: kratko stanje za animaciju
  prelaza rasporeda
- `training.component.ts:806` — `ghostDropsets` kroz `echoSetIn`
- `training.component.ts:1011`, `:1022`, `:1115`, `:1176`, `:1185` — BW polja kroz
  `bwField` (`startEditSet`, `saveEditSet`, `saveDropset`, `startEditDropset`,
  `saveEditDropset`)
- `training.component.ts:1297`, `:1354-1362` — sažetak broji po seriji
  (`setDeltas`); par vrijedi koliko njegova slabija strana
- `training.component.ts:1381-1383` — `totalSets` po `doneCount`
- `training.component.html:150` — datum prošlog treninga dobio opis `echoHint`
- `training.component.html:169`, `:176` — bedževi po `showBwBadge`/`showSidesBadge`
- `training.component.html:245`, `:393`, `:403` — sve grane rasporeda vezane za
  `splitLayout(ex)`; `.sets` dobio `[class.reflow]`
- `training.component.html:298`, `:328`, `:355` — placeholderi „BW" po `bwField`
- `training.component.scss:241-248` — bedževi „BW"/„L·D" dobili ulaznu animaciju
  (`tag-in`), gašenje uz `prefers-reduced-motion`
- `training.component.scss:462-498` — prelaz rasporeda (jedan red ↔ dvije
  kolone): razliv `sets-reflow` + kap `sets-ink`, ugašeno uz reduced-motion
- `training.service.ts:66-77` — `ECHO_ROW_LIMIT` 20 → 40; komentar ispravljen
  (granica je u REDOVIMA, a jednoručni dan ima dva reda po seriji, pa se dan od
  desetak serija sjekao u pola)
- `profile.service.ts:186-202` — kalendar broji parove `exercice_id#set_number`

**Efekat:** Paljenje ili gašenje L/D i BW na vježbi više ne mijenja nijedan
raniji dan — istorija prikazuje kako je dan stvarno rađen. Promjena flaga usred
treninga je bezbjedna: numeracija teče dalje, brojač je tačan u oba smjera.
Dvoručni dan poslije jednoručnog konačno ima duhove i strelice. Stara BW serija
ostaje izmjenjiva i pošto se flag ugasi. Rekord po ponavljanjima pada i kod
vježbe koja se ranije radila sa tegom. Prelaz rasporeda i pojava bedževa imaju
pokret (kućni „tečni" jezik), sve ugašeno uz `prefers-reduced-motion`.

**Napomene:**
- `saveLog` namjerno i dalje bira strane po FLAGU (`isUnilateral ? ['L','D'] :
  [null]`): flag kaže kako se vježba prati OD SADA, `splitLayout` kako se dan
  crta. Ko ugasi flag usred dana, nastavlja dvoručno, a već upisane L/D serije
  ostaju u svojim kolonama.
- `deleteSet` i dalje prenumeriše unutar strane. Kod dana koji miješa dvoručne i
  L/D redove (flag mijenjan usred treninga) brisanje zna ostaviti rupu u
  numeraciji — brojanje po različitim `set_number` vrijednostima je tačno i
  tada, samo brojevi na pilulama nisu uzastopni. Rijedak slučaj, ostavljen.
- `session_exercices` i dalje ne čuva flagove — nije potrebno, jer serije nose
  istinu. Migracija nije rađena.

---

## [2026-07-31] Donja navigacija „Kupola" (opt-in prototip) + sklopiva Podešavanja u profilu
**Tip:** funkcija (eksperiment iza prekidača)

**Šta:** Donja navigacija dobila drugi izgled — „Kupola": luk koji izranja sa
dna ekrana, ikone sjede na rubu luka, a preko njih se prstom prevlači
izdignuto svijetleće TJEME koje uz oprugu sjeda na najbližu stavku i navigira
(tap radi kao i uvijek; prevlačenje na odjavu se odbija — odjava traži tap).
Pokret je kućni jezik: squash & stretch kupole pri prevlačenju, ink-bloom iz
tjemena pri promjeni rute, ikone izranjaju talasom; `prefers-reduced-motion`
sve gasi, tjeme tada preskače.

- `src/app/services/nav-mode.service.ts` (novo) — izbor `classic`/`dome` po
  uređaju (localStorage `gymapp.footerMode`), primjena uživo (BehaviorSubject),
  klasa `nav-dome` na `<html>`. **Podrazumijevano je `classic`** — kupola je
  opt-in dok se isprobava, niko ne vidi promjenu dok je sam ne upali.
- `src/app/components/footer/*` — klasični futer NETAKNUT (stilovi vraćeni iz
  HEAD-a nakon što ih je međukorak bio progutao); kupola pod svojim klasama:
  geometrija luka i položaji ikona se računaju u TS-u (elipsa + Gausova
  blizina tjemenu + magnetni klizaj), opruga za snap, ResizeObserver za sve
  širine (na laptopu ostrvo u sredini).
- Kupola NE rezerviše traku: host visine 0, dok lebdi preko sadržaja
  (`footer.component.scss`), sadržaj teče ispod luka i vidi se i dodiruje
  kroz providne uglove (`pointer-events` propušta sve van oblika luka);
  prostor za skrol iznad tjemena vraća `app.component.scss`
  (`.content.app-scroll` padding uz `nav-dome`); `--footer-h` raste na 96px
  samo uz `nav-dome` (`_tokens.scss`) pa se modali i lebdeća dugmad sami
  poravnaju, a klasični režim ostaje na 64px — piksel u piksel kao prije.
- `src/app/components/profile/*` — sistemske kartice (Izgled, Notifikacije +
  nova „Meni") preseljene u jednu SKLOPIVU sekciju „Podešavanja" (zatvorena
  po defaultu, stanje u localStorage; tijelo se razliva, kartice izranjaju
  talasom sa korakom po kartici) — profil više nije pretrpan prekidačima.

**Zašto:** Markova ideja — donji meni kao „slider/polukrug sa moćnom
animacijom"; prekidač omogućava testiranje u produkciji (LiveContainer) bez
uticaja na ostale korisnike.

**Dopuna istog dana — tečni jezik i u klasičnom režimu (Markova primjedba):**
klasični futer je restauracijom ostao bez ijedne ulazne animacije, pa je dobio
isti jezik kao kupola, u diskretnijoj mjeri (`footer.component.scss`): ikone
pri ulasku izranjaju talasom (60ms korak po ikoni), novoaktivirana ikona se
slegne uz squash & stretch pop, a iz nje se razlije kap mastila kroz pilulu
aktivne rute. Sve ugašeno uz `prefers-reduced-motion`.

**Dopuna istog dana — visina klasičnog futera:** `--footer-h` 64 → 72px
(`_tokens.scss:159`) — ikone su na telefonu sjedale prenisko uz ivicu pa ih je
bilo teško pogoditi palcem. Kupola i dalje diže token na 96px kroz `nav-dome`.

**Dopuna istog dana — vitkije zaglavlje:** `--header-h` 86 → 74px
(`_tokens.scss`) i logo 62 → 50px (`header.component.scss`) — zaglavlje je na
telefonu djelovalo masivno, najviše zbog loga. Potrošači tokena (blog „nazad",
login/register, globalni offseti) poravnavaju se sami.

---

## [2026-07-31] Cyberpunk „glitch" preko ekrana za trenutke napretka (volt/gold)
**Tip:** funkcija (vizuelni efekat)

**Šta:** Trenuci moći dobili drugi registar pokreta — kratki „glitch" preko
cijelog ekrana u stilu Cyberpunk 2077 efekata: volt vinjeta po ivicama,
pixel-stretch trake sa trzajem i skew-om, nagovještaj RGB splita (crvena +
cijan nit), scanline treptaj; uz rekord još i dijagonalni holografski šimer i
„datamosh" blokovi. Tečni/mastilo jezik ostaje za svakodnevne prelaze — glitch
svira SAMO uz napredak.

- `src/app/services/glitch.service.ts` (novo) — `trigger('volt' | 'gold')`,
  Subject sa rastućim ključem; novi ključ ponovo rodi slojeve overlaya
  (`*ngFor="let k of burst"` trik iz skill-a tecne-animacije), pa se animacija
  restartuje i usred prethodnog prolaza.
- `src/app/components/glitch-overlay/*` (novo) — `<app-glitch-overlay>`:
  fixed, inset 0, `pointer-events: none`, z-index 120 (iznad sadržaja, headera
  50, futera 60 i toasta 100; ISPOD svih modala 150–300). Registrovan u
  `app.module.ts`, ubačen na dno `app.component.html` (uz profile-preview).
  - **'volt'** (~520ms, veća kilaža): vinjeta 520ms + 3 trake 430–520ms
    (kaskada 0/40/90ms) + RGB niti 300ms + scanline 380ms — udar, treptaj,
    signal se uhvati i sve nestane.
  - **'gold'** (~880ms, rekord): ista mašinerija u zlatnoj paleti (lokalni
    #FFD75A/#F5C445 tonovi — zlata nema u tokenima) + šimer 700ms + 3 datamosh
    bloka na `steps(2)`; tempiran da udari u istom taktu sa plamenom rekorda.
- Performanse (iPhone WKWebView): animira se isključivo transform/opacity,
  slojevi su statični gradijenti, nema filter/backdrop-filter; `will-change`
  važi samo dok slojevi postoje (rađaju se po okidanju, tajmer ih ukloni,
  čisti se u ngOnDestroy). `prefers-reduced-motion` — overlay se uopšte ne
  rađa (matchMedia guard u komponenti + `display: none` u CSS-u).
- Obje teme: 'volt' čita tokene pa se sam preslika (u svijetloj je volt
  tamnozelen; vinjeta prigušena kroz `:host-context([data-theme='light'])`,
  trake/blokovi prelaze na `multiply` — mastilo umjesto neona); 'gold' u
  svijetloj dobija dublji jantar (#A67C00 tonovi).
- `src/app/components/training/training.component.ts` — okidači: u
  `buzzProgress` (unutar `saveLog`) uz `progressHaptics('weight')` ide
  `glitch.trigger('volt')` + `audio.play('glitch')` — SAMO za granu veće
  kilaže, ne za ponavljanja; u `refreshPr` uz `progressHaptics('record')` ide
  `glitch.trigger('gold')` — vibracija + glitch + zvuk = jedan sinhron trenutak.
- `src/app/services/audio.service.ts` — novi slot `'glitch'` po postojećem
  obrascu, ali sa PRAZNIM nazivom fajla: snimak još nije nabavljen, pa se svaki
  poziv tiho preskoči (guard `!CLIPS[name]` u `play`/`prefetch`/`playElement` —
  bez mrežnog zahtjeva i bez 404 u konzoli). Kad Marko izabere snimak, samo se
  upiše naziv fajla u `CLIPS`.

**Zašto:** Markova želja — da napredak u kilaži i rekord „udare" kao special
effect iz Cyberpunka 2077, sinhrono sa vibracijom i zvukom, a da ostatak
aplikacije zadrži tečni jezik pokreta.

**Dopuna istog dana — sigurna zona iPhone-a je bila isključena:**
`src/index.html` viewport meta nije imao `viewport-fit=cover`, pa je iPhone
držao `env(safe-area-inset-*)` na nuli — futer (i klasični i kupola) lijepio
se za samu donju ivicu ispod trake za gestove, ma koliko se visina štimala.
Sada `--safe-b`/`--safe-t` stvarno rade: futer sam odskoči iznad trake za
gestove, zaglavlje ispod notcha. Uz to kupola: rub luka blaže pada na uskim
ekranima (0.17→0.13 širine, kapa 60px) i krajnje ikone + tjeme su zaštićeni
od isijecanja (clamp na visinu doka u `render()`), jer su na iPhone-u home i
odjava virili van ekrana.

**Dopuna istog dana — logo prati temu:** zaglavlje u svijetloj temi koristi
novu varijantu loga (`assets/logo_light_mode.png`, Marko dodao) —
`header.component.html` bira po `ThemeService.isLight`, promjena je trenutna
pri prebacivanju teme.

**Dopuna istog dana — logo prati temu SVUDA + futer vraćen na 64px:** svijetla
varijanta loga sada i na landing/login/register ekranima (ThemeService +
`[src]` na sva četiri mjesta gdje logo postoji); `--footer-h` vraćen 72 → 64px
— „prenisko" je zapravo bila isključena sigurna zona, pa je poslije
`viewport-fit=cover` popravke 72px postalo previsoko.

**Dopuna istog dana — kompaktniji futer uz živu sigurnu zonu:** ukupna traka
(pojas ikona + ~34px gestova) bila je previsoka — `--footer-h` 64 → 52px
(dugmad od 46px i dalje staju), kupola 96 → 86px.

**Dopuna istog dana — traka se vizuelno završava ispod ikona (IMG_4577):**
pozadina klasičnog futera blijedi kroz zonu gestova umjesto da je farba —
pojas ikona + sigurna zona ofarbani istom bojom činili su jednu ogromnu ploču
na dnu telefona. Ikone i dalje sjede iznad zone gestova; na desktopu
(safe-b = 0) gradijent se sam uruši u punu boju.

**Dopuna istog dana — redizajn po Markovoj povratnoj informaciji:** prva
verzija (vinjeta + poluprovidne trake + RGB niti + scanline) presuđena kao
„očajna, konfuzna, nema dopamin" — zamijenjena drskim sci-fi efektom u TRI
faze, i efekat sada NOSI PORUKU (`trigger(kind, message)`):

1. **Trzaj samog UI-ja (0–240ms):** overlay lijepi klasu `glitch-jolt` na
   `<html>` (skida je tajmerom, restart zamjenom klase preko reflow-a, čisti u
   ngOnDestroy); globalni stil na dnu `_base.scss` pod njom trza CIJELI
   `.shell` u tvrdim `steps(1)` koracima — translateX ±5–8px + na tren isječen
   `clip-path` kadar (na ~50ms ostane samo srednji pojas slike). Sadržaj se
   stvarno pomjeri.
2. **Neprovidne trake (0–350ms):** 4 krupne pune trake (4–9vh; naizmjenično
   `--volt-fill`/zlatna i `--deep`), tvrde ivice, skoče u `steps(2)` pa nestanu
   na rez — pomjereni redovi piksela, vidljivo i drsko.
3. **Oluja znakova + dekodiranje (120ms–kraj):** velika mono poruka
   (`--font-data`, clamp 28–40px, volt/zlatna + glow) skremblovana JS
   intervalom (45ms) iz skupa `#?!01<>/\_ΔΞ$%&` pa se slova slijeva nadesno
   zaključavaju u konačan tekst; oko nje 10–14 malih znakova (Math.random
   pozicije/kašnjenja) blicne pop-om kaskadno; poruka odstoji pa se raspadne u
   3 tvrda koraka (`steps(1)` opacity/translate/skew). Interval i svi tajmeri
   se čiste u ngOnDestroy i pri restartu.

Trajanja: volt ~950ms (dekodiranje ~230ms, poruka stoji do 720ms), gold
~1350ms (dekodiranje ~500ms, poruka stoji do 1120ms, zadržan holografski
šimer 100–800ms; i dalje u taktu sa plamenom). Poruke iz
`training.component.ts`: volt = razlika kilaže prema istoj seriji prošlog
treninga preko `echoSetIn` („+2,5 kg" — pola kile zaokruženo, zapeta), gold =
`prMetric` vrijednost i jedinica („NOVI REKORD · 32 kg", za čist BW
„NOVI REKORD · 15 pon."). Performans pravila ista (transform/opacity +
clip-path samo na shell trzaju; bez filtera); `prefers-reduced-motion` i dalje
gasi sve, uključujući klasu na `<html>`. Stara mašinerija (vinjeta, stretch
trake, RGB niti, scanline, datamosh) uklonjena.

**Dopuna istog dana — safe-area podizač uklonjen (Markova presuda):**
`viewport-fit=cover` vraćen iz index.html (iOS sam drži stranicu iznad trake
za gestove — kao prije), `--footer-h` nazad na zatečenih 64px. Gradijent i
`--footer-gap` u futeru ostaju u kodu ali miruju (safe-b = 0). Kupola ostaje
na 86px sa zaštitom krajnjih ikona.

**Dopuna istog dana — prekidač „Efekti" u Podešavanjima:** glitch spektakl
preko cijelog ekrana je po izboru (`GlitchService.enabled`, localStorage
`gymapp.glitchFx`, podrazumijevano uključen) — slabiji telefon ili mirniji
ukus ga gasi u Profil → Podešavanja → Efekti. Gasi SAMO glitch: plamen
rekorda, zvuk i vibracije ostaju uvijek (Markova specifikacija).

## [2026-07-31] Splash redizajniran: ASCII talas-polje iz kojeg izranja identitet
**Tip:** funkcija (vizuelni efekat)

**Šta:** Landing je bio logo + natpis bez ijedne animacije. Sada je cijeli
ekran ASCII more od monospace znakova koje se stvarno talasa, a identitet iz
njega IZRANJA — kućnim tečnim jezikom, uz nagovještaj glitch registra
(dekodiranje natpisa iz šuma). Splash je uz to skraćen sa 4s na 3,4s i može se
preskočiti dodirom.

**Kadar (vremenska osa je u konstantama na vrhu `landing.component.ts`, SCSS
kašnjenja moraju je pratiti):**

1. **0–900ms** — more se budi iz praznine: raste i amplituda i srednji nivo
   gustine, pa ekran krene kao rijetka prašina znakova pa se ispuni talasima
   (da raste samo amplituda, prvi kadar bi bio ravan zid od jednog znaka).
   Istovremeno se kroz polje SKUPLJA udar ka centru (implozija koja jača kako
   se sabija) i stiže tačno na ~700ms.
2. **560ms** — logo izranja: `mark-surface` (istegnut po visini dok se diže →
   prebačaj → slijeganje, squash & stretch) + `ink-bloom` kap `--volt-a40` iza
   njega + prsten `ring-out` koji odlazi sa loga. U istom trenutku voda oko
   identiteta se RAZMAKNE — gustina pada ka nuli u elipsi (viša nego šira, jer
   ispod loga stoje natpis i mjerač), pa u moru ostane rupa u koju identitet
   stane.
3. **640ms** — drugi udar odlazi napolje kroz polje (parnjak prstena sa loga).
4. **980–1540ms** — natpis „JEBA NE SMIJE DA STANE" se DEKODIRA iz šuma
   slijeva nadesno (isti postupak kao `glitch-overlay`, skup znakova
   `#?!01<>/\_$%&*+=~`, samo ASCII). Mono font je obavezan: da slova nisu
   jednake širine, linija bi se trzala dok se zaključavaju.
5. **1560–2880ms** — mjerač `ZAGRIJAVANJE [######--------]` se puni do samog
   preusmjerenja.
6. **2880ms** — izlaz: posljednji udar iz centra + amplituda nabuja 90%, kadar
   se blago udalji i pretopi, identitet POTONE nazad (ink-retreat osjećaj).
7. **3380ms** — `waitForSession()` pa `/dashboard` ili `/login` (tok zadržan).

**Kako se crta i koliko košta:**

- `src/app/components/landing/landing.component.html` — polje su **dva `<pre>`
  čvora** i ništa više: `.deep` nosi mirnu vodu, `.crest` samo grebene u volt
  boji. Svaka ćelija ide u tačno jedan sloj, drugi na tom mjestu dobija
  razmak — znakovi se ne preklapaju, a `text-shadow` sjaj pada samo na ~7–9%
  ćelija koje ga traže. Po kadru se upisuju dva `textContent`-a; nijedan DOM
  čvor se ne pravi ni ne briše (nema canvasa, nema hiljadu `<span>`-ova).
- `landing.component.ts:331` (`draw`) — visina talasa je zbir tri sinusa, ali
  se sinusi računaju PO KOLONI i PO REDU, ne po ćeliji: dijagonalni član se
  razlaže preko `sin(a+b) = sin a·cos b + cos a·sin b`, pa u unutrašnjoj petlji
  ostanu samo sabiranja i množenja. Rastojanje ćelije od centra (za prsten
  udara) i težina mirne vode računaju se JEDNOM pri mjerenju, u
  `Float32Array`-ima.
- `landing.component.ts:260` (`layout`) — mreža se izvodi iz širine ekrana
  (~34 kolone, znak 10–20px), a stvarna širina znaka se IZMJERI skrivenim
  lenjirom od 20 „M" umjesto da se vjeruje konstanti 0.6em — ako font zakasni
  ili padne na sistemski, mreža bi inače bila kriva. Ista mjera se ponovi na
  `resize` (150ms odgoda) i na `document.fonts.ready`.
- Mjereno (Node, ista petlja): **~0,07ms po kadru** za 1100–1850 ćelija
  (telefon 36×38, laptop 74×25). Petlja radi na ~30fps (`rAF` sa preskokom na
  33ms), **van Angular zone** i piše direktno u `textContent` — nijedan kadar
  ne pokreće provjeru promjena. U zonu se vraća samo preusmjerenje.
- Sve ostalo je transform/opacity.

**Preskok:** klik/dodir bilo gdje (`(click)="skip()"` na korijenu) ili bilo
koji taster (`@HostListener('document:keydown')`) — pretapanje krene odmah kao
potvrda i ide se pravo na login/dashboard; `leaving` zastavica čuva od dvostrukog
preusmjerenja.

**Obje teme:** boje idu kroz tokene pa se preslikaju same — mirna voda je
`color-mix(--ice 15%)` (na kosti tanak grafitni reljef), grebeni `--volt`. U
svijetloj temi (`:host-context([data-theme='light'])`) grebeni se spuštaju na
66% tamnozelene i GASI im se sjaj — neon glow na svijetlom samo zamuti znak;
sjenka loga sa 90% crne prelazi na `--ice` mix, jer je crna na kosti mrlja a
ne dubina.

**`prefers-reduced-motion`:** JS ne pokreće petlju nego nacrta JEDAN statičan
kadar (`draw(1400)`), natpis je odmah dekodiran, mjerač pun; CSS gasi sve
ulaze, kap, prsten i pretapanje. Tok i trajanje ostaju isti.

**Čišćenje:** `stop()` u jednom mjestu gasi `requestAnimationFrame`, oba
tajmera (izlaz i preusmjerenje), odgodu resize-a i sam `resize` osluškivač;
zove se i iz `ngOnDestroy` i pri odlasku sa ekrana, pa ništa ne tiktače nakon
splasha.

**Dopuna istog dana — zvukovi efekata (Markovi fajlovi):** `level_up_kg.mp3`
ide uz volt glitch (veća kilaža), a pri rekordu se PREKO dugog `record` klipa
pušta i kratki `new_PR.mp3` — novi `AudioService.playOver()` sloj kroz
WebAudio (više izvora kroz isti gain, bez prekidanja glavnog kanala).

**Dopuna istog dana — V3: ASCII talas umjesto traka (Markovo oduševljenje
landingom):** poslije ASCII mora na splashu („takvom nečemu sam se nadao kod
glitch efekata") neprovidne trake i mala oluja znakova iz v2 su izbačene, a na
njihovo mjesto došao **ASCII TALAS** — nalet polja monospace znakova koji
prohuja preko ekrana slijeva nadesno, kao da se more sa landinga na tren
prelije preko aplikacije. Mijenjana SAMO glitch-overlay komponenta; trzaj
shella (`glitch-jolt` u `_base.scss`), poruka sa dekodiranjem, okidači u
trainingu i servis ostali isti.

- **Tehnika iz landinga** (`glitch-overlay.component.ts`): dva <pre> čvora
  (`deep` providan volt ton, `crest` grebeni + glow na ~15% ćelija),
  `textContent` po kadru na ~30 fps, rAF petlja VAN Angular zone (nijedan
  kadar ne pokreće CD), lenjir mjeri stvarnu širinu znaka, mreža i statično
  zrno po ćeliji (Float32Array) se prave samo kad se broj ćelija promijeni.
  Polje je stalno u DOM-u (prazno ne košta ništa) da ViewChild reference
  postoje prije prvog kadra.
- **Front i gustina:** front ide konstantnom brzinom (ulazi/izlazi van
  ekrana), po redu krivuda kroz dva sinusa računata PO REDU; gustina ćelije =
  1 na frontu, uski sprej ispred (3–4 kolone, linearno), iza fronta
  eksponencijalno gašenje kroz unaprijed izračunatu WAKE tabelu (bez exp() u
  petlji); ćelija se pali kad gustina nadmaši njeno zrno — prorjeđivanje je
  doslovno vjerovatnoća. Treptaj daje pomak indeksa zrna po kadru, grebeni
  povremeno blicnu znakom šuma (talas JE oluja — mali sparkovi iz v2 stopljeni
  u njega). Redovi mimo fronta se pune isječcima gotovog praznog reda.
- **Registri:** volt ~950ms (talas 860ms, rep 14 kolona), gold ~1350ms (talas
  1200ms, gušći ×1.25, rep 20 kolona, zadržan šimer 100–800ms; u taktu sa
  plamenom). Teme kao landing: svijetla bez glowa, volt kroz tokene
  (tamnozelen), zlato duboki jantar #A67C00.
- **Cijena kadra** (Node simulacija iste petlje, mreža telefona 36×42): volt
  0,008ms, gold 0,010ms; laptop 76×50: 0,014ms — cilj <0,2ms premašen ~20×.
- **Čišćenje:** rAF se sam gasi kad talas istekne (`stopWave` briše oba
  <pre>), restart okidanja prekida prethodni rAF pa kreće novi sat; u
  `ngOnDestroy` se gase rAF, interval skremblovanja, svi tajmeri i skida
  `glitch-jolt` sa <html>.

**Dopuna istog dana — v3.1, bez trzaja + tečnija poruka (Markova dorada):**
trzaj cijelog UI-ja uklonjen u potpunosti (klasa, tajmer, stil u _base.scss —
„shaky screen je malo previše"); talas nosi svu dramu. Poruka („+2 kg") sada
u kućnom jeziku: izranja uz squash & stretch spring (320ms), iza nje se
razlije kap mastila (`msg-box::before`), a odlazi rasplivom — razvuče se i
potone u prozirnost (260ms) umjesto tvrdih rezova.

## [2026-08-10] iPhone PWA: sistemski gest više ne navigira, aplikacija se vraća gdje je stala, splash samo pri prvom otvaranju

Markova prijava: usred treninga izađe iz PWA ili zaključa ekran, a pri povratku
osvane na dashboardu ili leaderboardu. Dva uzroka, tri povezane popravke.

### 1. Futer ne smije da navigira na iOS sistemski gest

Gest izlaska iz PWA kreće uvis sa donje ivice ekrana — tačno preko futera.

**Kupola** (`footer.component.ts`):
- `pointercancel` više ne dijeli tok sa `pointerup`: novi `onCancel`
  (`footer.component.ts:467`) NIKAD ne zove router — tjeme se oprugom vrati na
  aktivni slot (van doka: na sredinu), a eventualni procureli `click` se
  proguta. Ranije je prekid pokazivača prolazio kroz `onUp` i „birao" stavku.
- Prag za početak prevlačenja (`onMove`, `footer.component.ts:384`): sa 5px
  bilo kakvog pomaka podignut na ~12px PRETEŽNO VODORAVNOG (`|dx| > |dy|·1,4`;
  prati se i `clientY`). Pretežno vertikalan pokret (≥12px) pušta praćenje
  (`abandonDrag`, `footer.component.ts:484`) — skrol ili sistemski gest, ne
  prevlačenje po doku.
- **offDock stanje** (`footer.component.ts:104`): za rute van stavki doka
  (npr. `/training`) `activeIndex()` vraća -1, a tjeme je ranije sjedalo na
  slot 0 (`/dashboard`) — pa je svaki „snap" vodio tamo. Sada: tjeme miruje na
  SREDINI luka (`restSlot()` = 2,5, između ikona — bez ležišta na ikoni), i u
  `initDock` i preko NavigationEnd pretplate. Prevlačenje van doka navigira
  SAMO ako se završi na stavci (`onUp`: puštanje na < pola slota od sredine →
  opruga nazad, bez routera; isto i za puštanje na slotu odjave kad nema
  aktivne rute).

**Klasični futer** (`footer.component.html:20` `#flat` +
`footer.component.ts:550-611`): između `pointerdown` i `pointerup` mjeri se
pomjeraj; preko ~10px (vertikalni je upravo početak sistemskog gesta) →
`click` se guta u capture fazi prije RouterLink-a — isti obrazac kao
`suppressClick` u kupoli. Tap bez pomjeranja prolazi netaknut.

### 2. Pamćenje i vraćanje posljednje rute

Novi servis `src/app/services/last-route.service.ts` — localStorage ključ
`gymapp.lastRoute.<userId>`, sadržaj `{ url, ts }`:
- `remember(url, userId)` — piše SAMO rute sa bijele liste (/dashboard,
  /exercices, /leaderboard, /profiles, /blog, /news, /training), url CIO — sa
  query parametrima (`?date=` ostaje). Nikad `/`, `/login`, `/register`.
  Poziva se iz postojeće NavigationEnd pretplate u `app.component.ts:63-64`
  (userId iz AuthService; bez korisnika nema upisa).
- `consume(userId)` — vrati url ako je svjež, inače null (bajat zapis obriše).
  Svježina: `/training` BEZ `?date` („današnji trening") važi samo ako je
  zapis od DANAS (isti kalendarski dan, lokalno) I mlađi od `LIVE_WINDOW_H`
  (4h, import iz `shared/warmup-grace.ts` — ista granica kao „trenira sada");
  `/training` SA `?date` i sve ostale rute: 2 sata.
- Čita ga `landing.component.ts` u `leave()`: prijavljen korisnik ide na
  `consume()` url preko `navigateByUrl` (query preživi), tek ako nema svježeg
  zapisa na `/dashboard`. `guestGuard` netaknut.
- `signOut` u futeru (`footer.component.ts:613`) briše zapis korisnika — druga
  prijava na istom telefonu ne osviće na tuđem ekranu.

### 3. Splash samo pri prvom otvaranju

iOS pri svakom relaunch-u PWA kreće od start_url `/` — pun „pljesak krede" od
3,1s svirao je i poslije običnog zaključavanja ekrana.

- `landing.component.ts`: marker `gymapp.splashSeen = ts` u **localStorage-u
  sa pragom od 6h** (`SPLASH_FRESH_MS`) — namjerno NE sessionStorage: kad iOS
  ubije proces PWA, sessionStorage se briše, pa bi povratak opet imao pun
  splash. Pun splash samo kad zapisa nema ili je stariji od 6h; inače KRATKI:
  `quick = true`, tajmeri `T_EXIT_SHORT = 240ms` / `T_LEAVE_SHORT = 620ms`
  (~600ms ukupno) kroz POSTOJEĆI `fadeOut`/`.leaving` tok pretapanja.
- `landing.component.scss` `.landing.quick`: bez oblaka krede i prstena, logo
  izroni skraćenim squash & stretch (280ms), natpis i traka odmah za petama
  (rise 240ms), traka puna od starta. U `prefers-reduced-motion` bloku dodate
  i `.quick` varijante (konkretniji selektor bi inače pregazio gašenje) —
  smanjen pokret i dalje gasi SVE.
- `landing.component.html`: `[class.quick]="quick"` na `.landing`.

**Efekat:** izlazak/zaključavanje usred treninga → povratak za ~0,6s pravo na
`/training` (sa datumom ako je bio otvoren), bez lažne navigacije futera.

**Build:** `ng build --configuration development` prolazi; jedine dvije
poruke su zatečena NG8107 upozorenja u training templateu.

---

## [2026-08-10] Trajni nacrti, brži ulasci, bezbjedan updateFullPlan, limiti
**Tip:** popravka + performanse

Po Markovim prijavama sa terena (drugi dio paketa; prvi je „iPhone UX trojka"
iznad):

1. **Trajni nacrti** — novi `DraftService` (localStorage, verzija šeme u
   ključu, otporan na punu memoriju). Plan builder čuva CIO nacrt (naziv,
   opis, tip, dani, režim izmjene, tekući dan) debounce-om 500ms; klik na
   overlay = „sačuvaj i zatvori", dugme Otkaži = odbaci; pri povratku na
   dashboard animirana traka „Imaš nedovršen plan — Nastavi / Odbaci" (kućni
   jezik, ink + talas). Bilješka treninga se čuva po sesiji (300ms) i vraća
   pri ulasku. Rješava „krenem plan, izađem, sve ispočetka".
2. **Brži ulasci** — dashboard: 4 nezavisna upita kroz `Promise.all`
   (serijska dubina 4→1); `/exercices` bez duplog `getMuscleGroups`;
   `getOrCreateSession` prima lijenu funkciju za plan i zove je SAMO kad
   sesija ne postoji — svaki sljedeći ulazak u trening štedi
   `plan_members` + cio `getFullPlan` (1–2 serijska kruga).
3. **`updateFullPlan` više ne može pojesti plan** — redoslijed obrnut na
   „prvo upiši NOVE dane, pa obriši STARE po zapamćenim id-jevima"; prekid na
   pola ostavlja stari plan netaknut (dokazano na lokalnoj bazi: namjerni FK
   prekid — broj dana ni u jednom trenutku ispod 7). `insertDays` paralelno.
4. **Limiti na upite koji rastu zauvijek** — ekipa 20000 redova, kalendar
   2000/20000, pragovi rekorda 5000 (velikodušno; semantika netaknuta).

**Dopuna istog dana — dvije vizuelne popravke kupole (Markove prijave):**
1. Van doka (npr. /training) tjeme je stajalo na 2,5 pa je Gausova blizina
   podizala i rang-listu i profil kao „dva izabrana taba" — sada se tjeme
   SAKRIJE (opacity, meki prelaz), sve ikone leže ravno na luku, zarezi
   hladni; vraća se čim krene stvarno prevlačenje ili povratak na stavku doka
   (`flat` u render(), klasa `offdock`).
2. `.modal-overlay` (_base.scss) i blog lightbox `.lb` su se završavali na
   vrhu PRAVOUGAONE trake — pored luka kupole ostajale su neprekrivene rupe.
   U `nav-dome` režimu sada idu do same ivice ekrana (`bottom: 0` +
   `padding-bottom` čuva karticu iznad tjemena).

**Dopuna istog dana — popup = pun panel između traka (Markov app_sc.png):**
`.modal-card` je na telefonu bio lebdeći bottom-sheet sa zaobljenim vrhom —
ispod zaglavlja su kroz zaobljenje virila dva „zareza" scrima (utisak greške),
a dizajn se pravio da trake ne postoje. Sada: na telefonu kartica PUNI cio
međuprostor između traka (height 100%, bez radijusa, bez sopstvenih ivica —
trake je omeđuju); ≥640px ostaje centrirani zaobljeni dijalog. Važi za sve
kućne modale (birač vježbi, planovi, rezime, težina, pregled profila...).

**Dopuna istog dana — bez sive trake ispod panela (Markov app_bug.jpg):**
u kupola režimu panel se završavao iznad zone kupole pa je ispod ostajala
siva pravougaona traka scrima sa lukom u sredini. Sada panel (i blog
lightbox) ide do SAME ivice ekrana i prekrije i kupolu — ona je pod scrimom
ionako neaktivna dok je modal otvoren — a unutrašnji padding kartice drži
sadržaj u zoni palca.

**Dopuna istog dana — desktop meni + tečni reflow (Markove prijave):**
1. Panel-preko-kupole ograničen na telefon (max-width 639px) — na desktopu je
   svaki otvoren modal prekrivao i meni pa je izgledalo da je „nestao"; sada
   na ≥640px meni ostaje vidljiv ispod centriranog dijaloga.
2. Traka nedovršenog plana animira i svoj ZAUZETI PROSTOR (draft-grow /
   draft-collapse: max-height + margin + padding + border), ne samo sebe — pa
   sadržaj ispod TEČE za njom umjesto da skoči. Pravilo upisano i u skill
   tecne-animacije kao obavezno za svaki ulazak/izlazak elementa iz toka.

## [2026-08-10] Redizajn UX-a plan buildera — dan-tabovi, tečni birač vježbi, sticky akciona traka
**Tip:** funkcionalnost
**Ref:** Markova primjedba „UI za pravljenje treninga nije toliko dobar"

**Problem:** Modal za pravljenje/izmjenu plana je crtao svih sedam dana kao
mrežu stisnutih kartica: izbor vježbe se jedva vidio (tanka promjena obruba),
serije/ponavljanja su bila dva gola polja ispod kartice, „Gotovo"/„Sačuvaj" se
tražilo skrolom, redovi u danu bez sličica i bez animacije preuređivanja,
native `<select>` za tipove je otvarao sistemski točak, a prazan dan nije
govorio šta dalje.

**Rješenje:** Editor plana presložen oko JEDNOG dana sa tabovima PON–NED
(bedž broja vježbi + obojen tip dana; prelaz dana ulazi talasom, unazad
obrnutim redom). Sadržaj skroluje između zaglavlja i STALNE akcione trake
(Otkaži · napredak `n vježbi · m/7 dana` · Sačuvaj). Birač vježbi je pun panel
sa jasnim zaglavljem, pretragom i ljepljivim nazivima grupa; izabrana kartica
dobija volt okvir/ispunu, kap mastila iz TAČKE DODIRA i redni broj u danu, a
iz kartice se tečno izduži „ostrvo" sa serije × ponavljanja i +/- steperima
(dynamic-island obrazac iz treninga; prostor animiran — susjedi teku). Red
liste dana: sličica (dodir → isti pregled kao tab Vježbe), redni broj, naziv,
čip serije×pon., strelice sa FLIP animacijom (recept iz treninga) i uklanjanje
kroz kolaps prostora. Native selecti zamijenjeni kućnim `app-dropdown`
(animiran panel, kap iz dodira, tastatura, `t-field-min`). Validacija:
„Sačuvaj" je vizuelno ugašeno dok forma ne valja, a dodir protrese polja koja
fale (naziv/tip/opis) i ispiše poruku uz traku. Nacrt (planDraft) i dalje radi:
snimak sada nosi i `picture` po vježbi (stari nacrti se dopune iz kataloga),
a prolazna animaciona stanja (closing/pop) se NE snimaju.

**Dodirnuti fajlovi:**
- `src/app/components/shared/dropdown/dropdown.component.{ts,html,scss}` —
  novo: kućni padajući meni (listbox), animiran po skillu tecne-animacije
- `src/app/components/shared/exercice-detail/exercice-detail.component.{ts,html,scss}` —
  novo: pregled vježbe izdvojen sa taba Vježbe u zajedničku komponentu
- `src/app/components/exercices/exercices.component.html:112` — detalj modal
  zamijenjen `<app-exercice-detail>`; `.scss` — preseljeni stilovi uklonjeni
- `src/app/app.module.ts` — deklarisane obje nove komponente
- `src/app/components/dashboard/dashboard.component.ts` — `SelectedExercice`
  dobija `picture` + prolazna polja; `planDraft()` snima samo trajna polja;
  `backfillPictures()`; FLIP `moveInDay`/`flipRow`; `removeFromDay` sa
  kolapsom; `goToEditDay`/`editDayKey`/`dayAnimDir`; birač: `pickerQuery`,
  `pickerShownGroups`, `pickedOrd`, `toggleExercicePick` sa kapi iz dodira i
  `islandClosing`; steperi `bumpTarget`; validacija `formReady`/`shakeInvalid`
  (tip plana sada obavezan); pregled `openExPreview` (grupe lijeno, keširano)
- `src/app/components/dashboard/dashboard.component.html` — modal plana:
  `plan-scroll` + `plan-actionbar`, dan-tabovi, `day-pane` (rađa se iznova po
  `editDayKey`), lista `sel-row`, prazna stanja; birač `picker2`; preview
- `src/app/components/dashboard/dashboard.component.scss` — sekcija „EDITOR
  PLANA" + „BIRAČ VJEŽBI (picker2)"; mrtvi stilovi stare mreže uklonjeni;
  sve novo pokriveno `prefers-reduced-motion`

**Efekat:** Na telefonu se plan slaže dan po dan palcem: tab pokazuje koliko
je gdje izabrano, izabrana vježba se vidi iz aviona (okvir + broj + ostrvo sa
ciljevima), „Sačuvaj"/„Gotovo" su uvijek na ekranu, preuređivanje se VIDI, a
prazan dan kaže tačno šta da se uradi. Sve promjene stanja su animirane
kućnim jezikom; nacrt preživljava i dalje svaki prekid.

**Napomene:** Dugme „Sačuvaj" namjerno NIJE `disabled` dok forma ne valja —
mrtvo dugme ne umije da objasni zašto; umjesto toga je vizuelno ugašeno, a
dodir trese polja koja fale. Tip plana je novim pravilom obavezan i pri
izmjeni starih planova bez tipa. Stari nacrti (bez `picture`) se dopunjavaju
pri vraćanju; šema nacrta ostaje `v1` jer je izmjena unazad kompatibilna.

---

## [2026-08-10] Ostrvo za unos rezultata u treningu
**Tip:** UX redizajn

Polja za upis (posebno dropset i izmjena serije) bila su premala — „gađanje
prstom" (Markova prijava). Sada sve tri forme dijele JEDNU osnovu `.io`
(training.component.scss): pri otvaranju se forma TEČNO raširi u ostrvo —
polja 52px visine, cifre 20px mono, prostor raste (`io-grow`, susjedi teku) —
a ostatak kartice se priguši na 0.55 dok se kuca. Po upisu ostrvo se skupi
(`island-sip` + `io-collapse`) i nova pilula se rodi u istom taktu.

- **Izmjena serije**: pilula se morfuje NA LICU MJESTA u editor — prostor
  kreće od visine pilule (38px), ne od nule; zatvaranje unazad pa pilula
  preuzme. Bez „drugog reda ispod".
- **Dropset**: unos raste iz „+" tačke (kap mastila iz izmjerenog X-a),
  izmjena kao morf pilule; ista krupnoća kao glavna forma.
- **Steperi ±**: kilaža ±2,5 (poravnanje na korak), ponavljanja ±1; dugmad
  44px, drži-pa-ponavlja (420ms pa 110ms), prazno polje kreće od duh
  prijedloga; vrijednost „popne" pri promjeni; u čistom BW steper kilaže se
  skuplja kroz max-height.
- Netaknuti: BW čip (weight-slot flex tok), L/D kolone (polja se u koloni
  ruke prelamaju jedno ispod drugog), Enter-lanac, offline queue, vibracije/
  glitch okidači; `prefers-reduced-motion` gasi sve novo.

**Dopuna istog dana — dropdown: staklo + pametan smjer (Markov bug_2):**
providnost panela i probijanje sadržaja kroz listu riješeni trostruko:
(1) host se izdiže dok je lista otvorena (stacking vs animirani susjedi);
(2) panel je Apple mat staklo — providna podloga + backdrop blur 18px
(svijetla: mliječno bijelo; @supports fallback puna boja); (3) panel se
otvara NAGORE kad ispod okidača nema mjesta (dno modala/sticky traka bi ga
sjekli), max-visina po raspoloživom prostoru.

**Dopuna istog dana — ostrvo za unos v2 (Markove tri regresije) + dropdown fino:**
1. Vraćeni echo placeholderi („Kilaža"/„kg"/„pon." i brojevi-duhovi) — crtica
   ih je bila zamijenila pa je forma djelovala prazna; prefil ojačan: kad
   prošli trening nema tu seriju, prijedlog je posljednja današnja serija
   (`suggestFor`) — isti izvor za BW čip i stepere.
2. BW čip opet vidljiv i prepoznatljiv (jedinica vraćena u polje, steperi
   inline pa čip više ne davi među kutijama); skupljanje u čist BW glatko.
3. Diskretnije: polja 46px (bilo 52), cifre 18px (bilo 20), steperi inline
   [−][polje][+] 40×46 prozirni; Sačuvaj 46px; izračunat raspored za 390px i
   L/D kolone (polje preko cijele kolone, dugmad ispod).
4. Dropdown: veći dah od sticky trake pri mjerenju smjera (128px) i manje
   providno staklo (86%/84%) — ugniježdeni backdrop blur unutar modala ne
   muti pouzdano pa sama podloga mora nositi čitljivost.

**Dopuna istog dana — čist BW bez praznine (Markovi bw_on/bw_off):** skupljeni
elementi kilaže gubili su širinu ali ne i visinu, pa su se sa flex-wrap
prelamali u nevidljive redove i ostavljali ogromnu prazninu ispod čipa. Sada
u čistom BW gube i visinu (flex-basis/height/margin/padding 0), red je 46px:
čip + tihi natpis „tjelesna težina — dodir na BW dodaje teg", a ponavljanja
odmah ispod.

**Dopuna istog dana — čist BW u jednom redu (Markova dorada):** čip pri
čistom BW USKAČE u red ponavljanja — `[BW][−][Ponavljanja][+]` — umjesto
zasebnog reda sa natpisom; natpis uklonjen (`io-fields.bw-plain` nowrap).

**Dopuna istog dana — stacking doktrina + detalj vježbe u ljusci + futer dah:**
1. Detalj vježbe (tab Vježbe je crtao kupolu PREKO kartice — predak sa
   stacking contextom guta z-index sloja u toku stranice) preseljen u LJUSKU
   kao globalni sloj sa `ExerciceDetailService` (obrazac ProfilePreview);
   koriste ga i Vježbe i plan builder. Doktrina preklopnih slojeva upisana u
   docs/08-KONVENCIJE.md — strukturno, da se klasa buga više ne vraća.
2. Futerski „8px dah" ograničen na dodirne ekrane (`pointer: coarse`) — na
   mišu je dizao red ikona vidljivo („na webu je meni podignut više").

---

## [2026-08-10] Stale-while-revalidate keš sloj u localStorage — prvi piksel bez mreže
**Tip:** funkcionalnost / performanse
**Ref:** ADR-0003

**Problem:** Svaki ulazak na tab je počinjao spinnerom i čekanjem na Supabase —
na mobilnoj vezi u teretani 10–20 sekundi (Markove prijave). A čeka se na
podatke koji se praktično ne mijenjaju između dva ulaska: katalog vježbi,
šifarnici, planovi, struktura današnjeg treninga, kalendar, sedmica ekipe.

**Rješenje:** Novi `CacheService` — SWR keš u `localStorage` sa ključevima
`gymapp.cache.v1.<domen>.<userId|global>`. Komponenta na vrhu `ngOnInit`
SINHRONO `peek`-ne keš i odmah crta (spinner se i ne pojavi), pa SVEJEDNO zove
postojeću servisnu metodu; servis po uspjehu radi `put` i prikaz se tiho
dopuni — bez pražnjenja pa punjenja. Verzija šeme je u ključu (konstruktor
briše starije), lični podaci nose `userId` (telefon dijele dva korisnika),
puna memorija i neispravan JSON se tiho tolerišu (obrazac iz
`offline-queue.service.ts`). NIKAD se ne keširaju: `getSessionLogs` (izvor
istine), `getLiveSessions`, `getSessionTimes`, `getPersonalBests`/
`getBodyweightBests` (prag rekorda). Zašto ne `ngsw` dataGroups: ADR-0003
(kontrola invalidacije + sinhroni prvi render).

**Dodirnuti fajlovi:**
- `src/app/services/cache.service.ts` — NOVO: `peek`/`put`/`clear(prefix)`/
  `clearUser`; TTL konstante; čišćenje starih verzija šeme
- `src/app/services/exercice.service.ts:34,93,139` — peek/put kataloga (24h,
  globalno); `addExercice` obara katalog
- `src/app/services/dashboard.service.ts:33–53,79,94,164,186` — peek/put za
  myPlans/otherPlans (1h, po korisniku) i plan_type/day_type (7 dana,
  globalno); `:154,252,337` create/update/deleteFullPlan obaraju liste planova
  + razriješeni aktivni plan; `:461–517` follow/unfollow/activate/deactivate
  obaraju aktivni plan
- `src/app/services/training.service.ts:145,156` — peek/put razriješenog
  aktivnog plana (`training.activePlan.<uid>`); `:290,349` — peek/put strukture
  DANAS-sesije (`training.session.<uid>`, samo današnja, peek odbija tuđi
  datum); `:382–606` — sve izmjene sesije obaraju strukturu (zamjena,
  dodavanje, uklanjanje, redoslijed, ciljevi, bilješka, kraj/ponovno
  otvaranje), a L·D/BW flagovi i katalog
- `src/app/services/leaderboard.service.ts:168,172,316,455,499` — peek/put za
  sedmicu (30 min), rekorde (1h) i profile ekipe (6h; memorijski keš proširen:
  localStorage sjeme + tiho osvježenje u pozadini)
- `src/app/services/profile.service.ts:41,45,57,73,235,267` — peek/put profila
  (6h) i kalendara (1h); nova slika obara profil
- `src/app/components/dashboard/dashboard.component.ts:288–299` — prvi kadar
  lista i šifarnika iz keša; `:556–566` — traka dana iz keširanog plana
- `src/app/components/exercices/exercices.component.ts:60–99` — katalog iz
  keša, spinner samo kad nema ničega
- `src/app/components/leaderboard/leaderboard.component.ts:115–129` — sedmica/
  rekordi/katalog iz keša; greške tihog osvježenja ne viču preko sadržaja
- `src/app/components/profile/profile.component.ts:328–353` — profil/kalendar/
  katalog iz keša
- `src/app/components/training/training.component.ts:172,323–334,481,489` —
  skeleton iz keširane strukture (`hydrating`: prigušene karte, bez brojeva,
  dok logovi ne stignu); `:2026,2081` — birač pri dodavanju/zamjeni prvo iz
  keširanog kataloga
- `src/app/components/training/training.component.html:127` +
  `training.component.scss:106–130` — `hydrating` prigušenje, tečan povratak
  (tokeni `--d-slow`, reduced-motion ga sam gasi)
- `src/app/components/footer/footer.component.ts:638` — odjava briše SVE lične
  zapise keša (`clearUser`); globalni katalog ostaje
- `docs/05-decisions/ADR-0003-kes-sloj-localstorage.md` + red u registru

**Efekat:** Povratak na svaki tab crta odmah iz keša — planovi, katalog,
profil, kalendar, sedmica, rekordi i struktura treninga stoje na ekranu bez
ijednog round-tripa, a mreža ih u pozadini tiho dopuni. Živi podaci (serije,
„trenira sada", sat, rekordi-pragovi) i dalje uvijek čekaju mrežu.

**Napomene:** Prvi ulazak poslije prijave i dalje ide preko mreže (keš je
prazan). Ko dodaje novu mutaciju planova/sesije/kataloga, mora pogoditi
invalidaciju — spisak tačaka u ADR-0003. Ključevi reda čekanja
(`gymapp.queue.*`) i nacrta (`gymapp.draft.*`) nijesu dirani.

**Dopuna istog dana — ležište u staklu kupole (Markov menu_bug):** svijetleći
prsten aktivne ikone je na krajnjim pozicijama isplivavao van luka. Tjeme je
preseljeno U `.dock-surface` (overflow + luk radius ga sijeku oblikom stakla
— sjaj sada živi u kupoli), a krajnje ikone su blago uvučene ka unutra
(edge 0.115/36–58 → 0.155/50–70). Bez smanjivanja ikona — mete za palac
netaknute.

**Dopuna — WebKit kliping (Markova ponovljena prijava, s pravom):** Safari na
iPhone-u NE sijече kompozitnu djecu (translate3d sloj) kroz overflow+radius —
prsten je na telefonu i dalje isplivavao iako je na desktop Chrome-u bio
odsječen. `-webkit-mask-image: -webkit-radial-gradient(white, black)` +
`isolation: isolate` na `.dock-surface` tjeraju WebKit da kliping primijeni.
Pouka: vizuelna verifikacija na desktopu NIJE dokaz za iOS.

**Dopuna — cio krug, uvučeni tabovi (Markova presuda umjesto cutoffa):**
sječenje prstena lukom „ne valja — vrati": tjeme vraćeno IZVAN stakla (krug
uvijek cio), a geometrija uvučena da prsten stane POD luk: sjedište ikona
dublje (crestY 35→44), izdizanje 15→12, prsten 64→48 (ne dodiruje liniju),
kupola 86→92px. WebKit maska ostaje na staklu (čuva mastilo u obliku luka).

**Dopuna — Apple staklo na kupoli (Markova želja za detaljem):** pokretni
specularni odsjaj klizi po staklu prateći tjeme (`--sheen-x` iz render(),
radial blik odozgo; jači u svijetloj temi) + svjetlosni rub po vrhu luka
(inset sjaj). Maska luka sijece odsjaj u oblik stakla; reduced-motion ga
umiri u centar.

---

## 2026-08-10 — Plan po mjeri pojedinca (ADR-0004) + gašenje dvoklik-zuma

**Šta:** Tri funkcionalnosti iz testa sa korisnicom van grupe (uvid: „život
prekida plan" — menstruacija, bolest, pauza) + popravka dodira.

**1. Biranje dana za danas** (`training.service.ts` `changeSessionDay`,
`training.component.*`): dok trening nije počeo (nijedna serija), u zaglavlju
stoji čip „Promijeni dan" (na rest-day ekranu i dugme „Radi dan iz plana") →
birač svih 7 dana (naziv, tip, broj vježbi, oznake „danas po planu" i
trenutnog dana) → sesija se presloži iz izabranog dana. Plan NETAKNUT — mijenja
se samo današnja sesija (`workout_day_id`, `day_type_name`,
`session_exercices`); `day_label` ostaje stvarni dan (istorija: KAD vs ŠTA).
Brana u servisu: postoji li ijedan log, promjena se odbija. Model
`WorkoutSession` dobio `workoutDayId` (za kvačicu u biraču). Čip nestaje
kolapsom svog prostora (`gone` — max-width/padding→0), birač ima talas ulaska
po danima i sip izlaz.

**2. „Prilagodi sebi" zatvara krug** (`dashboard.component.ts` onSubmitPlan):
Filipova kopija tuđeg plana (2a67171) ostajala je mrtva — praćeni plan ima
prioritet u rezoluciji, a kopija se nije aktivirala. Sada: otprati original →
aktiviraj kopiju → prolazna potvrda (`saved-note`, koreografija draft trake).

**3. Privatni planovi** (`20260810000000_plan_visibility.sql`,
`is_private boolean not null default false`): prekidač „Privatan plan" u
builderu (opt-row obrazac kao kod vježbe), oznaka „Privatan" u pregledu.
`getOtherPlans` filtrira privatne; postojeći pratioci OSTAJU (privatnost skida
plan iz izloga, ne izbacuje ljude). Default javno — ništa se nikom ne mijenja.

**Uz to — dashboard traka „danas na redu"** sada čita SESIJU kad postoji
(keš `peekTodaySession` pa mreža), tek onda plan — poslije promjene dana ili
izmjene vježbi traka više ne laže; usput jedan upit manje (getSessionTimes +
getSessionByDate → samo sesija).

**Uz to — dvoklik-zum ugašen** (`_base.scss`): `* { touch-action:
manipulation }` — brzi uzastopni dodiri (steperi, serije) više ne zumiraju
stranicu; skrol i pinch ostaju. U LiveContainer ljusci se zum nije mogao ni
vratiti (Markova prijava). Univerzalni selektor je najniže specifičnosti —
posebna pravila (kupola `none`, špil `pan-y`) i dalje pobjeđuju.

**Zašto ne pomjeranje ciklusa:** odbačeno u ADR-0004 — dani nose imena dana u
sedmici, offset bi pravio zbrku, a biranje dana pokriva stvarnu potrebu.

**Dopuna istog dana — trake kao POVRŠINA, meni ispod plutajućih kartica,
poravnat birač dana (Markove prijave uživo):**

1. **Header, kupola i klasični futer prešli sa `--void` na `--carbon`** — u
   svijetloj temi su nosili TAČNO boju podloge pa su se stapali sa sadržajem
   („bar meni istom bojom"); sada su bijeli kao kartice (u tamnoj nijansu
   svjetliji od podloge). Sva tri mjesta u trojci — mijenjati zajedno. Pokretni
   odsjaj na bijelom staklu prešao u blagi volt ton (bijeli blik na bijelom ne
   postoji).
2. **`float-overlay` izuzetak** (`_base.scss`, `exercice-detail`): pregled
   vježbe je plutajuća kartica, a pravilo „scrim do dna" (≤639px, kupola) je
   ispod nje gutalo meni bez ičega preko njega. Plutajući slojevi sada
   zaustavljaju scrim iznad futera — meni ostaje vidljiv i upotrebljiv; zato
   ljuska pri navigaciji zatvara svoje slojeve (exDetail/preview close u
   NavigationEnd — idempotentno).
3. **Birač dana kao grid** — naziv | tip | broj vježbi | kvačica, kolone
   poravnate kroz sve redove (raniji flex je desni dio slagao „random").

**Dopuna — „Zatvori" odvojeno od liste dana:** u biraču dana je dugme sjedalo
uz posljednji red kao osmi dan. Sada: razmak + tanka linija iznad (zasebna
zona); na telefonu (pun panel) pada na dno u zonu palca (margin-top: auto).

**Dopuna — futer IZNAD scrima plutajuće kartice (menu_bug repriza):** scrim
pregleda vježbe se završava na ravnoj liniji vrha futera, a luk kupole i
prsten vire iznad nje — pa ih je scrim sjekao po pravoj liniji. Dok je
plutajuća kartica otvorena, ljuska stavi `float-open` na `.shell`, a futer se
izdigne iznad scrima (z 160 > 150): kupola cijela, meni klikabilan. Puni
paneli (bottom:0) i dalje prekrivaju futer kao do sada.

**Dopuna — zavjesa do dna, kupola iznad nje (Markov screenshot 22.55):**
prethodni pokušaj je scrim zaustavljao iznad futera, pa je pored kupole virio
oštar, svijetao sadržaj ispod ravne linije šava. Sada `float-overlay` scrim
ide DO SAMOG DNA na svim širinama (jednolika zavjesa i iza menija), kartica
se drži iznad menija paddingom, a futer (`float-open`, z 160) izranja IZNAD
zavjese — kupola cijela, bez šava, meni klikabilan.
