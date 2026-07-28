# 10 — iOS aplikacija (i Android)

> **Ispravka (28.07.2026):** produkcija je u stvarnosti na **Cloudflare Pages**
> (`https://gym-app-1gm.pages.dev`), ne na Vercelu kako starija dokumentacija
> tvrdi. Princip je isti — push na `main` objavi novu verziju — samo je
> platforma druga. Adresa je već upisana u `capacitor.config.ts`.


Kako od web aplikacije napraviti pravu aplikaciju na telefonu, bez plaćenog
Apple naloga. Ako ti se žuri, dovoljna su prva dva reda:

> **Aplikacija na telefonu je samo ljuska — kod nije u njoj.**
> `git push` na main stiže korisnicima sam. Nov build ljuske treba **samo** kad
> se doda novi nativni dodatak (plugin).

Sve što slijedi radi se na grani `native-app`.

---

## Šta je ljuska

Na grani `native-app` je dodat Capacitor 8.4.2. On pravi prazan iOS/Android
projekat čiji je cijeli sadržaj jedan `WKWebView` koji učitava adresu iz
`capacitor.config.ts` (`server.url`) — dakle **produkciju sa Vercela**.

Posljedica je jedina stvar koju treba zapamtiti iz cijelog dokumenta:

| Promijenio sam... | Treba li nov build i ponovna instalacija? |
|---|---|
| bilo šta u `src/` (ekran, servis, stil, bug) | **Ne.** `git push` na main i to je to |
| tekst, ikonicu u aplikaciji, novu stranicu | **Ne** |
| dodao novi Capacitor plugin (npr. kamera) | **Da** — nov `npx cap sync` i nov IPA |
| promijenio `appId`, ime ili `server.url` | **Da** |

Zato je ovo uputstvo nešto što se prođe **jednom**, a poslije se mjesecima ne
dira.

### Šta ljuska donosi

| Mogućnost | Radi |
|---|---|
| Haptika (vibracija na dugme, na kraj serije) | da |
| Lokalne, zakazane notifikacije | da |
| Tajmer odmora sa zvukom i kad je telefon zaključan | da — preko zakazane notifikacije |
| Push notifikacije **sa servera** | **ne** |

Push sa servera traži APNs, a APNs traži **plaćeni** Apple developer nalog.
Nema zaobilaska, nema trika. Zamjena je provjera pri otvaranju aplikacije
(„dok si bio odsutan, desilo se ovo").

---

## Preduslovi

| Treba | Ne treba |
|---|---|
| **Xcode** — besplatan, iz App Store-a | **CocoaPods** |
| Apple ID (obični, besplatan) | plaćeni developer nalog (99 $/god) |
| iPhone i kabl | Homebrew, Ruby, gemovi |

**CocoaPods se NE instalira.** iOS projekat je namjerno generisan sa Swift
Package Managerom (`npx cap add ios --packagemanager SPM`) upravo zato da bi se
izbjegao CocoaPods. Xcode sam povlači zavisnosti pri otvaranju projekta. Ako
naiđeš na tutorijal koji traži `pod install` — taj tutorijal ne važi za ovaj
repo.

---

## Prvi build — korak po korak

### 1. Paketi

```bash
git checkout native-app
npm install
```

### 2. Upiši produkcijsku adresu

U `capacitor.config.ts` stoji zakomentarisan `server` blok sa `TODO`. Otvori
**Ovaj korak je već odrađen** — upisana je `https://gym-app-1gm.pages.dev`.
Ako se adresa ikad promijeni: uzmi **stalnu** adresu (npr.
`gym-app.vercel.app`), **ne** adresu pojedinačnog deploya (one sa nasumičnim
znakovima u imenu — te umiru).

```ts
  server: {
    url: 'https://TVOJA-ADRESA.vercel.app'
  },
```

> Ako ovo preskočiš, aplikacija služi kod upakovan u ljusku i neće se sama
> ažurirati poslije `git push`. Za prvu probu je to u redu, kao trajno rješenje
> nije.

### 3. Prenesi konfiguraciju u iOS projekat

```bash
npm run build        # da `dist/gym-app` postoji — `cap sync` ga kopira
npx cap sync ios
npx cap open ios
```

`npx cap open ios` otvara Xcode. Prvo otvaranje traje — Xcode u pozadini
skida Swift pakete. Sačekaj da traka gore prestane da se vrti.

### 4. Potpis u Xcode-u

U lijevoj koloni klikni **App** (na vrhu) → u sredini tab
**Signing & Capabilities**:

1. Uključi **Automatically manage signing**
2. **Team** → `Add an Account...` → prijavi se svojim običnim Apple ID-em
3. Izaberi taj nalog kao Team

Ako Xcode kaže da je `com.gymapp.mobile` zauzet, promijeni `appId` u
`capacitor.config.ts` (npr. `com.gymapp.marko`), pa ponovo `npx cap sync ios`.

### 5a. Direktno na telefon (najkraći put)

Poveži iPhone kablom, izaberi ga gore kao odredište i pritisni **Run** (▶).

Prvi put telefon odbija da pokrene aplikaciju. Na telefonu:
**Settings → General → VPN & Device Management** → tvoj Apple ID → **Trust**.

Ovako instalirana aplikacija traje **7 dana**, a obnavlja se samo ponovnim
priključivanjem na Mac. Zato postoji korak 6.

### 5b. IPA fajl (za SideStore)

**Product → Archive** → u Organizeru **Distribute App**.

Besplatni nalog zna da zaključa te opcije. Rezervni put, koji uvijek radi:

1. U Organizeru desni klik na arhivu → **Show in Finder**
2. Desni klik na `.xcarchive` → **Show Package Contents** →
   `Products/Applications/App.app`
3. Napravi folder `Payload`, ubaci `App.app` u njega
4. Desni klik na `Payload` → **Compress**
5. Preimenuj `Payload.zip` u `GymApp.ipa`

---

## SideStore — da se potpis obnavlja sam

Problem besplatnog potpisa je što traje 7 dana. SideStore je aplikacija na
telefonu koja **sama** obnavlja potpis preko Wi-Fi mreže, bez kabla i bez Maca.

| Stvar | Vrijednost |
|---|---|
| Trajanje potpisa | 7 dana |
| Obnavljanje | automatsko, dok je SideStore instaliran i podešen |
| Limit aplikacija sa jednog besplatnog Apple ID-a | **3** |

Instalacija GymApp-a: otvori SideStore na telefonu → **+** → izaberi
`GymApp.ipa` (prebaci ga na telefon preko AirDrop-a ili Files aplikacije).

Sam SideStore se instalira jednom, po uputstvu sa njihovog sajta — to je
zaseban postupak i ne zavisi od ovog repoa.

---

## LiveContainer — samo ako te stisne limit od 3

LiveContainer je aplikacija koja druge aplikacije pokreće **unutar sebe**. Za
Apple je to jedna aplikacija, pa svih 5-6 aplikacija troši samo jedan od tri
slota.

> **UPOZORENJE:** ponašanje **lokalnih notifikacija unutar LiveContainera nije
> provjereno.** A lokalne notifikacije su cijeli razlog zbog kojeg ova ljuska
> postoji (tajmer odmora koji zvoni kad je telefon zaključan).
>
> Zato: **prvo instaliraj kroz čist SideStore i provjeri da tajmer zvoni.**
> LiveContainer uzmi tek ako ti stvarno fali slot — i ako notifikacije u njemu
> zapnu, vrati se na čist SideStore. Nemoj gubiti dan na debagovanje toga.

---

## Android — ukratko

Android je znatno lakši jer ne postoji potpisivanje kao prepreka.

```bash
npx cap sync android
npx cap open android
```

| Treba | Napomena |
|---|---|
| Android Studio + Android SDK | jedini preduslov |
| Nalog bilo koje vrste | **ne treba** |

U Android Studiju **Build → Build Bundle(s)/APK(s) → Build APK(s)**. Dobijeni
`app-debug.apk` prebaciš na telefon i otvoriš; telefon traži da dozvoliš
instalaciju iz nepoznatih izvora i to je sve. Debug APK **ne ističe** — nema
7 dana, nema obnavljanja.

---

## Česta pitanja i problemi

### Deployovao sam, a u aplikaciji je stara verzija

Aplikacija je bila otvorena u pozadini i drži staru stranicu. Zatvori je
potpuno (prevuci je iz liste otvorenih aplikacija) pa je otvori ponovo.

To je i jedini „ritual" koji korisnici treba da znaju.

### Kad moram da pravim nov IPA

Samo u tri slučaja:

1. dodat je nov nativni plugin,
2. promijenjen je `appId`, ime aplikacije ili `server.url`,
3. promijenjena je ikonica ili splash ekran.

Promjena u `src/` **nikad** ne traži nov IPA.

### Aplikacija se ne otvara / „više nije dostupna"

Istekao je potpis. Redom:

1. Otvori SideStore → **Refresh** na GymApp-u
2. Ako to ne prođe, instaliraj `.ipa` ponovo
3. Ako ni to, priključi telefon na Mac i pritisni **Run** u Xcode-u

**Ništa se ne gubi.** Podaci nisu u aplikaciji nego u Supabaseu — aplikacija je
prazna ljuska.

### Mogu li poslati notifikaciju svima kad neko obori rekord

Ne sa servera, dok nema plaćenog Apple naloga. Može se provjeriti pri otvaranju
aplikacije i pokazati poruka tada.

### Xcode traži `pod install` / prijavljuje da nema CocoaPods

Ignoriši. Projekat je na SPM-u. Ako si negdje slučajno pokrenuo
`npx cap add ios` bez `--packagemanager SPM`, obriši `ios/` folder i pokreni:

```bash
npx cap add ios --packagemanager SPM
```

---

## Budući korak — ne zaboraviti

Trenutno su `@capacitor/*` paketi samo na grani `native-app`, jer ih koristi
samo ljuska.

**Kad prvi nativni fičer uđe u web kod** — npr. tajmer odmora koji zove
`Haptics` ili `LocalNotifications` iza provjere `Capacitor.isNativePlatform()` —
ti paketi **moraju ući i u `package.json` na `main` grani.** Taj kod se
builduje na Vercelu, i ako paketa nema tamo, build pada, a s njim i sajt za sve.

---

## Sažetak

| Hoću da... | Šta radim |
|---|---|
| korisnici dobiju novu verziju | `git push` na main — ništa više |
| dodam nativni plugin | `npm i`, `npx cap sync ios`, nov IPA |
| napravim IPA | Xcode → Archive → (ili `Payload` + zip) |
| instaliram bez kabla | SideStore |
| zaobiđem limit od 3 aplikacije | LiveContainer — tek nakon provjere notifikacija |
| instaliram na Android | Android Studio → Build APK → otvori na telefonu |
| **instaliram CocoaPods** | **nikad** |
