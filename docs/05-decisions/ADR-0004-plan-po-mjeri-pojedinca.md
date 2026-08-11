# ADR-0004 — Plan po mjeri pojedinca: biranje dana, kopija do kraja, privatnost

Datum: 2026-08-10
Status: prihvaćeno

## Kontekst

Test sa korisnicom van grupe (Markova djevojka) otkrio je klasu problema koju
dosadašnji model ne pokriva: **život prekida plan**. Menstruacija, bolest,
putovanje — čovjek propusti dan i nema način da ga nadoknadi, jer je dan
plana zakovan za dan u sedmici (`workout_days.name = 'Ponedeljak'`, sesija se
pravi poređenjem sa današnjim imenom dana). Propustiš grudi u ponedjeljak —
čekaš sljedeći ponedjeljak.

Uz to, plan je **dijeljen**: prati ga više ljudi (`plan_members`), pa svako
prilagođavanje „za sebe" direktno u planu mijenja trening svima. I na kraju,
svaki plan je bio vidljiv svima i svako ga je mogao zapratiti — vlasnik nije
imao izbor.

## Odluka

Tri zahvata, sva tri na principu: **lično prilagođavanje ne smije dirati
zajedničko stanje**.

### 1. Biranje dana za danas — na SESIJI, ne na planu

Sesija se pri startu ionako **prepisuje iz plana i od tada živi sama**
(ADR logika iz `20260726000000_workout_sessions.sql`). To je tačna poluga:
`changeSessionDay` presloži današnju sesiju iz IZABRANOG dana plana —
`workout_day_id`, `day_type_name` i `session_exercices` se zamijene, a
`day_label` ostaje stvarni dan u sedmici (istorija kaže KAD, tip kaže ŠTA).

- Plan netaknut; drugi pratioci ne osjete ništa. Nula izmjena šeme.
- Dozvoljeno SAMO dok nema nijedne upisane serije (brana i u servisu).
- UI: čip „Promijeni dan" u zaglavlju treninga + dugme na rest-day ekranu.
- Dashboard traka „danas na redu" sada čita SESIJU kad postoji, pa tek onda
  plan — inače bi poslije promjene dana lagala.

### 2. „Prilagodi sebi" zatvara krug

Filipov `adaptPlan()` (commit `2a67171`) pravio je kopiju tuđeg plana, ali je
kopija najčešće ostajala mrtva: praćeni plan ima apsolutni prioritet u
`resolvePlanForUser`, a kopija se nije ni aktivirala. Sada poslije čuvanja
prilagođenog plana: **otprati original → aktiviraj kopiju → prolazna poruka**.

### 3. Privatni planovi (`workout_plan.is_private`)

Default javno (postojeće ponašanje; grupa su prijatelji). Privatan plan se
drugima ne pojavljuje u izlogu (`getOtherPlans` filtrira) i ne može se
zapratiti. **Postojeći pratioci ostaju** — privatnost skida plan iz izloga,
ne izbacuje ljude iz treninga. Filtriranje je u upitu, ne RLS — sigurnost je
svjesno zasebna faza (CLAUDE.md pravilo 5).

## Odbačeno: pomjeranje ciklusa za X dana

Per-korisnik offset nad planom (plan_members.offset) je odbačen: dani nose
imena dana u sedmici, pa bi „Ponedeljak" padao četvrtkom — model i UI bi
morali stalno prevoditi, a stvarnu potrebu (nadoknadi propušten dan) pokriva
biranje dana: sljedeće sedmice je čovjek prirodno opet u ritmu.

Ako grupa ikad poželi PRAVE rotirajuće cikluse (PPL svaka 2 dana, nevezano za
sedmicu), to je zaseban redizajn: dani plana kao pozicije u ciklusu + lično
sidro-datum po članu. Zabilježeno kao mogući budući ADR, ne sada.
