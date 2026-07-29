# Primjena migracija na cloud projekat

Lokalna baza se digne sama (`npm run setup`) i migracije se primijene bez
ikakvog koraka. **Cloud projekat ne prati migracije sam** — nema ničega što ih
tamo automatski izvršava.

Zato se ovo mora uraditi ručno kad god se doda migracija koja mijenja šemu, a
želi se raditi u režimu bez Dockera (`npm run start:cloud`).

---

## Kako (bez ikakvih lozinki i alata)

1. Otvori [Supabase Dashboard](https://supabase.com/dashboard) → projekat →
   **SQL Editor** → **New query**
2. Otvori migraciju iz `supabase/migrations/` koja još nije primijenjena
3. Kopiraj **cijeli sadržaj** i zalijepi u editor
4. **Run**

Migracije su pisane tako da se mogu pustiti i dvaput — koriste
`create table if not exists`, `add column if not exists` i
`drop ... if exists`. Ako slučajno pustiš već primijenjenu, neće ništa pokvariti.

---

## Šta je gdje primijenjeno

| Migracija | Lokalno | Cloud |
|---|---|---|
| `20260725000000_initial_schema.sql` | ✅ | ✅ već postojalo — **ne puštati** |
| `20260725000001_storage_policies.sql` | ✅ | ✅ već postojalo — **ne puštati** |
| `20260725000002_grants.sql` | ✅ | ✅ već postojalo — **ne puštati** |
| `20260726000000_workout_sessions.sql` | ✅ | ⬜ **treba pustiti** |
| `20260726010000_weight_logs.sql` | ✅ | ❔ **provjeriti sa Filipom** |
| `20260726020000_blog_media.sql` | ✅ | ❔ Filipova (R2) |
| `20260726030000_blog_media_size.sql` | ✅ | ❔ Filipova (R2) |
| `20260726040000_exercices_bodyweight.sql` | ✅ | ❔ Filipova |
| `20260727000000_dropset_logs.sql` | ✅ | ❔ Filipova |
| `20260727010000_mark_bodyweight_exercices.sql` | ✅ | ⬜ **treba pustiti** |
| `20260728000000_unilateral.sql` | ✅ | ⬜ **treba pustiti** |
| `20260728010000_news.sql` | ✅ | ❔ Filipova — vjerovatno već tamo |
| `20260728020000_custom_day_type.sql` | ✅ | ❔ Filipova — vjerovatno već tamo |

Napomena: `custom_day_type` je kod Filipa nastala kao `20260728000000_...` — ISTI
pečat kao `unilateral`, pa je evidencija migracija odbijala duplikat verzije.
Preimenovana je u `...020000` na grani XFactor; sadržaj je netaknut i idempotentan,
pa je svejedno pod kojim je imenom ko već pustio.

Posljednja (`unilateral`) donosi praćenje lijeve/desne ruke kod jednoručnih
vježbi: `exercices.is_unilateral` i `exercice_logs.side`. **Mora se pustiti
PRIJE deploya koda od 28.07.** — aplikacija od tada kolonu `side` šalje pri
SVAKOM upisu serije (kod dvoručnih kao `null`), pa bez migracije u produkciji
puca svaki upis, ne samo jednoručni. Isti uslov važi i za učitavanje ekrana
treninga, jer se `is_unilateral` čita u istom upitu kao naziv vježbe.

Prve tri migracije su **izvedene iz** cloud baze (iz `pg_dump`-a), pa tamo već
postoje. Puštanje nema smisla i samo pravi buku.

Četvrta je nova — donosi `workout_sessions` i `session_exercices`. **Bez nje
ekran treninga puca** u režimu `npm run start:cloud`, jer aplikacija traži
tabele kojih nema.

Ta migracija usput rekonstruiše sesije iz postojećih upisa u `exercice_logs`,
pa „prošli trening" ima podatke odmah, a ne tek od sljedećeg treninga.

Peta (`weight_logs`) je **Filipova** — donosi istoriju tjelesne težine. Pisao ju
je radeći protiv cloud baze, pa je vjerovatno već tamo puštena, ali to niko nije
zapisao. Prije nego što se pusti ponovo: `create table if not exists`, pa ne može
ništa pokvariti ako već postoji.

---

## Kad dodaš novu migraciju

Dopuni tabelu iznad. Ako se zaboravi, sljedeći put niko neće znati šta je gdje
primijenjeno — a to se ne može pouzdano provjeriti bez pristupa bazi.

---

## Alternativa, ako imaš DB lozinku

```bash
npx supabase link --project-ref nsiwfwjpzyzfzxejewar
npx supabase db push
```

CLI tada sam vodi računa šta je primijenjeno. Traži lozinku baze iz
Dashboard → Project Settings → Database.
