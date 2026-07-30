# ADR-0002 — Push notifikacije preko zasebnog Spring Boot servisa

**Datum:** 2026-07-30
**Status:** prihvaćeno

## Kontekst

Roadmap stavka 3.4 traži push notifikacije (PWA infrastruktura za to već
postoji — `@angular/service-worker`). Za slanje push notifikacija treba server
koji zna tajni Firebase Admin SDK ključ (service account) — taj ključ **ne
smije** završiti u browseru, pa direktan poziv iz Angulara ka Firebase Cloud
Messaging (FCM) nije opcija.

Aplikacija do sada nema nikakav backend server (vidi `CLAUDE.md` — "Nema
backend servera"). Sve što radi, radi iz browsera direktno prema Supabaseu.

## Razmotrene opcije

### A — Supabase Edge Function
Edge Function (Deno) drži Firebase service account kao secret i poziva FCM.
Ostaje u Supabase ekosistemu, nema novi jezik/runtime za deploy.
**Protiv:** autor projekta je izričito htio izbjeći Supabase Edge Functions za
ovaj dio (odluka data van koda, u razgovoru) — prije svega zbog želje da se
ova logika drži u Java/Spring Boot-u kojim se bolje vlada, van Deno/TS
edge-runtime ograničenja.

### B — Zaseban Spring Boot servis (izabrano)
Novi repo/projekat ("Gym app backend", `dev/`) — Spring Boot 4, Java 21. Drži
Firebase Admin SDK service account, izlaže REST endpointe za slanje i za
registraciju FCM tokena po korisniku. Autentikacija poziva ide preko
Supabase-izdatog JWT-a (isti projekat, `nsiwfwjpzyzfzxejewar`), validiranog
kroz Supabase-ov JWKS endpoint (asimetrični ES256 ključevi).
**Protiv:** prva pojava pravog backend sloja u projektu — novi deployment
target, novi runtime za održavanje, nova baza konekcija (Spring Boot se
spaja na isti Supabase Postgres direktno preko JDBC/JPA, ne preko
PostgREST-a kao Angular).

## Odluka

**Opcija B.**

Presudan razlog je eksplicitna želja da se ova logika piše u Spring Boot-u, ne
u Supabase Edge Functions. Sporedna korist: Spring Boot servis je opšte
namjenski FCM klijent — nije vezan samo za ovu aplikaciju, može se ponovo
koristiti.

Tabela `device_tokens` (user_id ↔ FCM token) živi u **istoj** Supabase
Postgres bazi kao i ostatak šeme, ali je kreira i njome upravlja Spring Boot
(Hibernate `ddl-auto: update`), ne migracija u `supabase/migrations/` — ta
tabela je vlasništvo backend servisa, ne Angular strane.

## Kako se izvodi

1. Angular: `firebase` (JS SDK) + ručno registrovan `firebase-messaging-sw.js`
   na zaseban scope (`/firebase-cloud-messaging-push-scope`), odvojen od
   `ngsw-worker.js` (scope `/`) — bez ovoga bi se dva service workera sudarila
   oko kontrole stranice.
2. Poslije logina: `PushNotificationService.registerForPush()` traži dozvolu,
   dobija FCM token, šalje ga na `POST {apiBaseUrl}/api/notifications/register-token`
   sa Supabase access tokenom kao `Authorization: Bearer`.
3. Prije signOut-a: `unregisterFromPush()` briše token sa backend-a (DELETE),
   dok Supabase sesija još važi za auth header.
4. Backend validira JWT preko Supabase JWKS-a (`sub` claim = user id), čuva
   token u `device_tokens`, i šalje notifikacije preko Firebase Admin SDK-a.
   Detalji backend implementacije: vidi `CLAUDE.md`/changelog u repou
   "Gym app backend".

## Posljedice

**Prihvatamo:**
- Prvi pravi backend server u projektu — deploy pitanje (gdje će Spring Boot
  servis raditi u produkciji) je **otvoreno i namjerno odloženo**. Trenutno
  radi samo lokalno (`localhost:8080`); `env.prod.ts.apiBaseUrl` je TODO
  placeholder dok se backend negdje ne deployuje javno.
- Dva service workera na istoj domeni — rijedak pattern, treba ga imati na
  umu pri budućim PWA izmjenama (ne dirati `ngsw-worker.js` scope).
- Supabase Postgres sad ima dvije vrste "vlasnika" šeme: Angular/migracije za
  aplikacione tabele, Spring Boot/Hibernate za `device_tokens`. Namjerna
  podjela, ne slučajno miješanje.

**Dobijamo:**
- Firebase service account ključ nikad ne dolazi u browser.
- Push logika je odvojena, testabilna nezavisno od Angular app-a (curl protiv
  backend REST API-ja).
- Push token se automatski briše kad FCM javi da je nevažeći
  (`UNREGISTERED`), bez ručnog čišćenja.

**Zatvara:** direktan poziv ka FCM iz browsera kao opciju — ubuduće svaki novi
tip notifikacije ide kroz ovaj backend, ne kroz novi Edge Function ili
direktan Firebase poziv iz Angulara.
