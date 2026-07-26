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
