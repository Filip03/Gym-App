# ADR-0003 — Stale-while-revalidate keš sloj u localStorage

**Datum:** 2026-08-10
**Status:** prihvaćeno

## Kontekst

Svaki ulazak na tab je počinjao spinnerom i čekanjem na Supabase — na mobilnoj
vezi u teretani (podrum, beton) i po **10–20 sekundi** (Markove prijave). A ono
što se čeka su podaci koji se iz minuta u minut praktično ne mijenjaju: katalog
vježbi, šifarnici tipova, liste planova, struktura današnjeg treninga, kalendar.
Aplikacija nema backend — sve ide iz browsera pravo na Supabase — pa se kašnjenje
mreže ne može sakriti ni na jednom serverskom sloju.

Cilj: pri ulasku na svaki tab **prvi piksel bez ijednog round-tripa** — sadržaj
odmah iz lokalnog keša, bez spinnera — a svježi podaci da stignu u pozadini i
tiho dopune prikaz.

Ograničenja:

- telefon dijele dva korisnika (Marko i Filip) — lični podaci ne smiju procuriti
  između naloga;
- neki podaci ne smiju NIKAD biti zastarjeli ni na prvom kadru: upisane serije
  (izvor istine), „trenira sada", sat sesije, pragovi ličnih rekorda (lažno
  slavlje rekorda je neprihvatljivo);
- `localStorage` već koriste red čekanja (`gymapp.queue.*`) i nacrti
  (`gymapp.draft.*`) — njih keš ne smije ni dirati ni istisnuti.

## Razmotrene opcije

**1. `ngsw` dataGroups (keš u postojećem service workeru).** Deklarativno, nula
novog koda u servisima. Odbačeno iz dva presudna razloga:

- *Nema sinhronog prvog rendera.* SW presreće `fetch` — komponenta i dalje čeka
  asinhroni odgovor (makar iz SW keša) prije prvog crtanja, a `supabase-js` mora
  proći cio svoj lanac. Cilj je bio da `ngOnInit` SINHRONO dobije podatke i
  ugasi spinner prije ijednog `await`-a.
- *Nema kontrole invalidacije.* dataGroups znaju samo URL šablone i TTL —
  „obriši keš planova kad se plan sačuva" ili „obori strukturu sesije kad se
  vježba zamijeni" se ne može izraziti. Baš te tačke čine zastarjelost
  bezopasnom.

**2. Samo memorijski keš u servisima.** Već postoji za profile ekipe — ali umire
sa tabom. Hladan start (a PWA na telefonu se stalno hladno pokreće) ne dobija
ništa, a upravo je on bolna tačka.

**3. IndexedDB.** Veći kapacitet, ali asinhron — opet nema sinhronog prvog
kadra. Isti zaključak kao u ADR-ovima reda čekanja i nacrta: za male objekte
koji se pišu rijetko, IndexedDB je asinhroni sloj bez ijedne koristi.

**4. SWR sloj u `localStorage` (izabrano).** Sinhroni `peek` za prvi kadar,
`put` po svakom uspješnom dovlačenju, ciljani `clear` na tačkama izmjene.

## Odluka

Novi `CacheService` (`src/app/services/cache.service.ts`): tanak sloj nad
`localStorage` sa ključevima `gymapp.cache.v1.<domen>.<userId|global>`.

- **Sinhroni `peek<T>(key, maxAgeMs)`** — komponenta na vrhu `ngOnInit` crta iz
  keša i gasi spinner, pa SVEJEDNO zove postojeću servisnu metodu; servis po
  uspjehu radi `put`, komponenta tiho dopuni prikaz. Tok podataka kroz servise
  je nepromijenjen — keš je bočni sloj, ne novi put.
- **Verzija šeme u ključu** (`v1`) — promjena oblika keširanog objekta podiže
  verziju; konstruktor briše zapise starijih verzija.
- **Vlasnik u ključu** — lični podaci (planovi, sesija, profil, kalendar) nose
  `userId`; odjava briše sve zapise tog korisnika (`clearUser`). Globalno
  (katalog, šifarnici, tim) preživljava odjavu — isto je svima.
- **TTL velikodušan po prirodi podatka** (30 min – 7 dana): zastarjelost je
  bezopasna jer iza prvog kadra UVIJEK ide tiho osvježenje; TTL je samo brana
  da se ne crta prastaro.
- **Nikad se ne keširaju:** `getSessionLogs`, `getLiveSessions`,
  `getSessionTimes`, `getPersonalBests`/`getBodyweightBests`. Ekran treninga iz
  keša dobija samo STRUKTURU dana (prigušenu, bez brojeva) dok logovi putuju.
- **Invalidacija na tačkama izmjene:** čuvanje/brisanje plana obara liste
  planova i razriješeni aktivni plan; svaka izmjena sesije (zamjena, dodavanje,
  uklanjanje, redoslijed, ciljevi, L·D/BW flagovi, kraj/ponovno otvaranje)
  obara strukturu sesije; nova vježba i flagovi obaraju katalog; odjava obara
  sve lično.

## Posljedice

- **Zastarjeli prikaz do osvježenja.** Prvi kadar smije biti star (plan koji je
  kolega u međuvremenu izmijenio, jučerašnji rekordi ekipe) — prihvata se
  svjesno, jer se ekran tiho ispravi čim mreža odgovori, a kritični podaci u
  keš i ne ulaze.
- **Puna memorija se tiho toleriše.** `QuotaExceededError` pri upisu žrtvuje
  CIO keš (i samo keš — red čekanja i nacrti su svetinja) pa pokuša još jednom;
  ako ni tada ne prođe, aplikacija radi kao da keša nema. Neispravan JSON = keš
  ne postoji.
- **Svaka nova tačka izmjene podataka mora pogoditi invalidaciju.** Ko doda
  novu mutaciju plana/sesije/kataloga, dužan je oboriti odgovarajući domen —
  inače prvi kadar laže duže nego što mora (do TTL-a, nikad trajno).
- **`localStorage` je sinhron** — keširaju se samo mali objekti (najveći je
  katalog sa ~40 vježbi, nekoliko desetina KB). Ništa binarno, nikakve slike
  (slike ionako idu preko public URL-ova i browser keša).
- Zatvara se mogućnost da se isti podaci kasnije „besplatno" prebace na ngsw
  dataGroups — invalidacione tačke sada žive u servisima i svaka migracija ih
  mora ponijeti.
