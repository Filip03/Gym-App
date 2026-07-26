# 09 — Koju komandu kada

Kratko uputstvo po slučajevima. Ako ti se žuri, dovoljna su prva dva reda:

> **`src/environments/env.ts` se NIKAD ne mijenja rukom.**
> Za deploy ne treba ništa mijenjati — Angular sam podmetne cloud podatke.

---

## Zašto se `env.ts` ne dira

Postoje **dva** fajla sa podacima o bazi:

| Fajl | Na šta gađa | Kad se koristi |
|---|---|---|
| `src/environments/env.ts` | **lokalni** Supabase (Docker) | samo pri `npm start` |
| `src/environments/env.prod.ts` | **cloud** Supabase | pri svakom buildu i pri `start:cloud` |

U `angular.json` stoji `fileReplacements` koji pri produkcijskom buildu
**zamijeni** `env.ts` sa `env.prod.ts`. To znači:

**Šta god upišeš u `env.ts`, u deployovanoj aplikaciji toga nema.**

Provjereno na stvarnom buildu — u `dist/gym-app/main.*.js` stoji cloud adresa, a
riječ `54321` (lokalni port) se ne pojavljuje **nijednom**:

```bash
grep -c 54321 dist/gym-app/main.*.js     # 0
```

Zato mijenjanje `env.ts` pred deploy ne rješava ništa — a lomi lokalni razvoj
svima ostalima i pravi konflikt pri svakom spajanju grana.

---

## Slučaj 1 — Radim na aplikaciji, hoću punu kontrolu

Baza se diže lokalno u Dockeru. Radi bez interneta, podaci su lažni pa se ništa
ne može pokvariti, i možeš slobodno brisati i mijenjati šta hoćeš.

```bash
npm start
```

→ `http://localhost:4300`, baza `http://127.0.0.1:54321`

Prvi put, ili ako baza nije dignuta:

```bash
npm run db:start
```

---

## Slučaj 2 — Neću Docker, hoću pravu bazu

Isti dev server, ali gađa **cloud** bazu. Radiš nad pravim podacima, pa oprez —
što obrišeš, obrisano je i za sve ostale.

```bash
npm run start:cloud
```

→ `http://localhost:4300`, baza cloud

**Ovo je komanda umjesto mijenjanja `env.ts`.** Radi isto što si radio ručno,
samo bez izmjene fajla.

---

## Slučaj 3 — Deploy

```bash
git push
```

To je sve. Vercel sam pokrene `npm run build`, koji podmetne `env.prod.ts`.
**Ništa se ne mijenja rukom ni prije ni poslije.**

Ako hoćeš da prije toga provjeriš da build prolazi:

```bash
npm run build
```

---

## Slučaj 4 — Neko je dodao migraciju

Lokalna baza se ažurira sama:

```bash
npm run db:up
```

**Cloud se NE ažurira sam.** Migracije se tamo puštaju ručno:

1. [Supabase Dashboard](https://supabase.com/dashboard) → projekat → **SQL Editor**
2. Otvori migraciju iz `supabase/migrations/` koja još nije puštena
3. Kopiraj cijeli sadržaj → **Run**
4. **Upiši u tabelu** u `supabase/cloud/README.md` da je puštena

Migracije koriste `create table if not exists`, pa se mogu pustiti i dvaput bez
štete.

> Ako se ovo preskoči, aplikacija u produkciji traži tabele kojih nema i ekran
> puca — a lokalno sve radi, pa se greška ne vidi dok neko ne otvori sajt.

---

## Slučaj 5 — Povukao sam tuđe izmjene

```bash
git pull
npm install          # ako se package.json mijenjao
```

Pa **ugasi i ponovo pokreni** dev server (`Ctrl+C`, `npm start`).

Restart nije formalnost: webpack popis modula pravi jednom, pri pokretanju. Ako
je server bio upaljen prije `npm install`, javljaće

```
Cannot find module '@ffmpeg/ffmpeg'
```

iako paketi jesu na disku. Jedini lijek je restart.

---

## Sažetak

| Hoću da... | Komanda |
|---|---|
| radim sa lokalnom bazom | `npm start` |
| radim sa cloud bazom | `npm run start:cloud` |
| deployujem | `git push` |
| primijenim migraciju lokalno | `npm run db:up` |
| primijenim migraciju na cloud | ručno, SQL Editor — vidi `supabase/cloud/README.md` |
| **promijenim `env.ts`** | **nikad** |
