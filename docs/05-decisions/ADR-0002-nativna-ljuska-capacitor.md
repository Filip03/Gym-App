# ADR-0002 — Nativna ljuska (Capacitor) koja učitava produkciju sa Vercela

> **Ispravka (28.07.2026):** produkcija je u stvarnosti na **Cloudflare Pages**
> (`https://gym-app-1gm.pages.dev`), ne na Vercelu kako starija dokumentacija
> tvrdi. Princip je isti — push na `main` objavi novu verziju — samo je
> platforma druga. Adresa je već upisana u `capacitor.config.ts`.


**Datum:** 2026-07-28
**Status:** prihvaćeno

## Kontekst

Aplikacija je Angular 16 PWA. Podaci idu direktno iz browsera u Supabase, nema
backend servera, a deploy je push na `main` koji Vercel sam objavi. Radna grana je
`XFactor`. Korisnici su mala grupa prijatelja, primarno na iPhone uređajima.

Ograničenja koja traže odluku:

- **iOS Safari ne daje haptiku.** `navigator.vibrate` na iOS-u ne postoji, pa
  potvrda upisa serije ostaje samo vizuelna.
- **Notifikacije iz PWA na iOS-u nijesu pouzdane.** Tajmer odmora zavisi od toga
  da li je kartica živa; kad se telefon zaključa, zvuk izostane. Tajmer koji ne
  javi kraj pauze nije tajmer.
- **Aplikacija se ne objavljuje javno.** Nema App Store-a, nema plaćenog Apple
  developer naloga, i ne planira se. Instalacija mora biti moguća sa besplatnim
  Apple ID-em.
- **Tempo razvoja se ne smije usporiti.** Trenutno se izmjena vidi kod svih
  odmah nakon push-a na `main`. Sve što uvede korak „pa sad svi ponovo
  instalirajte" praktično znači da se izmjene prestaju objavljivati.

Dakle: trebaju nam nativne mogućnosti, ali bez naloga koji se plaća i bez
gubitka postojećeg toka objavljivanja.

## Razmotrene opcije

### A — Ostati čist PWA

Ništa se ne mijenja. Aplikacija se dodaje na početni ekran preko Safarija.

**Protiv:** ne rješava nijedan od dva problema zbog kojih se odluka i pokreće.
Haptike nema, a notifikacije nijesu pouzdane dok je uređaj zaključan. Ovo je
tehnički zid Safarija, ne stvar podešavanja — nema zaobilaska u web sloju.

### B — Upakovati web fajlove u aplikaciju

Capacitor ljuska koja u sebi nosi `dist/gym-app`. Klasičan hibridni pristup.

**Protiv:** svaka izmjena u web kodu traži nov build ljuske, nov potpis i nov
sideload na svaki telefon u grupi. Za projekat koji se mijenja skoro svaki dan to
je neprihvatljivo — objavljivanje bi se svelo na to koliko često se ljudima da da
kače aplikaciju preko računara. Dodatno, verzije korisnika bi se razišle: neko na
prošlonedjeljnoj, neko na jučerašnjoj.

### C — Tanka ljuska sa udaljenim URL-om

Capacitor ljuska koja ne nosi kod aplikacije. `server.url` u konfiguraciji pokazuje
na produkciju na Vercelu, pa WKWebView učitava živu aplikaciju. Ljuska daje samo
nativni sloj: haptiku, lokalne notifikacije, životni ciklus aplikacije.

**Protiv:** aplikacija bez interneta ne radi (a i ne bi, jer ionako sve čita iz
Supabasea). Vezuje nas za to da produkcijska adresa bude stalna. Ako se Vercel
projekat preimenuje ili adresa promijeni, instalirane aplikacije pokazuju praznu
stranu dok se ne izda nova ljuska.

## Odluka

**Opcija C — tanka ljuska sa `server.url` ka Vercelu.**

Presudni razlog je očuvanje postojećeg toka objavljivanja. Kod aplikacije ostaje
tamo gdje jeste — na Vercelu, iza push-a na `main` — a ljuska je samo omotač koji
otvara nativne mogućnosti. Posljedica je da **svaki push na `main` stiže
korisnicima sam**, bez ijedne radnje sa njihove strane. Nov build ljuske treba
**samo** kad se doda novi nativni dodatak (plugin).

Opcija B bi isti taj rezultat naplatila ponovnim sideload-om za svaku sitnicu, a
opcija A ne rješava ništa.

## Kako je postavljeno

Na grani `native-app` (izvedenoj iz `XFactor`):

- Capacitor **8.4.2**. Paketi: `@capacitor/core`, `@capacitor/ios`,
  `@capacitor/android`, `@capacitor/haptics` 8.0.2,
  `@capacitor/local-notifications` 8.2.1, `@capacitor/app`;
  `@capacitor/cli` kao razvojna zavisnost.
- `capacitor.config.ts`: `appId` `com.gymapp.mobile`, `appName` `GymApp`,
  `webDir` `dist/gym-app`, `ios.contentInset` `'never'` (aplikacija već sama
  rješava safe-area, pa ljuska ne smije dodavati svoje razmake).
- **`server.url` je zakomentarisan placeholder sa TODO.** Prije prvog builda tu
  treba upisati **stalnu produkcijsku adresu** (Vercel → projekat → Domains), a
  **ne** adresu pojedinačnog deploya — adresa deploya se mijenja pri svakom
  objavljivanju i aplikacija bi zamrzla na jednoj staroj verziji.
- iOS projekat je generisan sa Swift Package Managerom
  (`npx cap add ios --packagemanager SPM`) jer **CocoaPods nije instaliran** i ne
  treba ga instalirati. Android projekat je standardan. `npx cap sync` prolazi.

Instalacija na telefon bez plaćenog naloga:

1. **Xcode** (besplatan, App Store) — potpis besplatnim Apple ID-em.
2. **SideStore** — sam obnavlja potpis, koji inače traje 7 dana; limit je
   3 aplikacije.
3. Opciono **LiveContainer** — zaobilazi limit od 3 aplikacije.

> **Neprovjereno:** kako se lokalne notifikacije ponašaju **unutar
> LiveContainera**. Prvo probati čist SideStore, pa tek onda LiveContainer ako
> limit od 3 aplikacije zasmeta.

## Posljedice

**Dobijamo:**

- **Haptiku** — vibracija kao potvrda upisa serije i drugih radnji.
- **Lokalne (zakazane) notifikacije** — tajmer odmora se zakaže unaprijed, pa se
  oglasi zvukom **i kad je telefon zaključan**, bez obzira na to da li je
  aplikacija u prvom planu.
- Objavljivanje ostaje isto kao danas: push na `main`, i to je to.
- Ikonu na početnom ekranu i ponašanje prave aplikacije, bez App Store-a.

**Prihvatamo:**

- **Push notifikacije sa servera nijesu moguće.** APNs traži plaćen Apple
  developer nalog i tu nema zaobilaska. Zamjena je provjera pri otvaranju
  aplikacije — što god treba javiti, javlja se kad korisnik uđe.
- **Potpis traje 7 dana.** Uz SideStore obnavljanje je automatsko, ali traži da
  aplikacija povremeno dobije priliku da se obnovi; ako je uređaj dugo van
  domašaja, aplikacija prestane da se otvara dok se potpis ne obnovi.
- **Limit od 3 aplikacije** potpisane besplatnim nalogom.
- **Aplikacija zavisi od interneta i od stalne adrese na Vercelu.** Bez mreže
  nema ekrana. Promjena produkcijske adrese znači nov build i nov sideload.
- Postoji još jedan artefakt koji se održava — `capacitor.config.ts` i dva
  nativna projekta. Ne diraju se često, ali postoje.

**Zatvara:** ideju da se aplikacija distribuira kao samostalan paket sa
upakovanim kodom. Od ove odluke, aplikacija na telefonu je prozor u produkciju,
a ne kopija aplikacije.

## Budući korak

Dok ljuska stoji sama na grani `native-app`, `@capacitor` paketi žive samo tu i
to je u redu — web kod ih ne poziva.

**Čim prvi nativni fičer uđe u web kod** (na primjer tajmer odmora koji zove
`Haptics` ili `LocalNotifications` iza provjere `Capacitor.isNativePlatform()`),
`@capacitor` paketi **moraju ući i u `package.json` na grani `main`**. Razlog: taj
kod se gradi na Vercelu, pa bez zavisnosti build produkcije puca. Provjera
`isNativePlatform()` čuva ponašanje u browseru, ali ne mijenja to da uvoz mora
postojati u vrijeme builda.
