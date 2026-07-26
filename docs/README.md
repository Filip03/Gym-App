# Dokumentacija GymApp

Ova dokumentacija postoji da bi bilo ko — a prije svega **kolega koji je pisao
originalni kod** — mogao da otvori repo i razumije šta je promijenjeno, zašto, i
kako sistem radi, bez čitanja diffova.

## Odakle početi

| Ako si... | Čitaj ovim redom |
|---|---|
| Prvi put u repou | `00-ARHITEKTURA.md` → `01-DATABASE.md` → `07-LOCAL-SETUP.md` |
| Došao da pokreneš app | `07-LOCAL-SETUP.md` |
| Autor originalnog koda | `06-CHANGELOG.md` → `04-ROADMAP.md` |
| Došao da pišeš kod | `08-KONVENCIJE.md` → `02-STANJE-KODA.md` |

## Sadržaj

| Fajl | Šta sadrži |
|---|---|
| `00-ARHITEKTURA.md` | Stack, tok podataka kroz slojeve, granice sistema |
| `01-DATABASE.md` | Šema baze, relacije, RPC funkcije, storage bucketi |
| `02-STANJE-KODA.md` | Zatečeno stanje pri preuzimanju: bugovi, dug, mrtav kod |
| `03-SIGURNOST.md` | Popis sigurnosnih rupa — **nije u repou**, vidi `03-SIGURNOST.PROCITAJ.md` |
| `04-ROADMAP.md` | Faze rada i status svake stavke — **izvor istine** |
| `05-decisions/` | ADR — jedna arhitektonska odluka po fajlu |
| `06-CHANGELOG.md` | Svaka izmjena: šta / gdje / zašto / efekat |
| `07-LOCAL-SETUP.md` | Pokretanje lokalno, korak po korak |
| `08-KONVENCIJE.md` | Kodni standardi, dizajn tokeni, pravila imenovanja |

## Kako se dokumentacija održava

Pravila su u `CLAUDE.md`, sekcija 8. Ukratko:

- Završena izmjena → unos u `06-CHANGELOG.md`
- Strukturna odluka → novi ADR u `05-decisions/`
- Promjena stanja zadatka → `04-ROADMAP.md`
- Promjena šeme baze → migracija **i** `01-DATABASE.md`

Za to postoje agenti u `.claude/agents/` — `docs-keeper` održava ove fajlove,
`code-explainer` piše objašnjenja namijenjena kolegi.
