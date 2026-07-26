# 05 — Arhitektonske odluke (ADR)

Jedna odluka = jedan fajl. Format: `ADR-NNNN-kratki-naziv.md`.

ADR se piše kad odluka **mijenja strukturu** — novi sloj, nova tabela, promjena
toka podataka, izbor alata, ili svjesno odbacivanje očiglednog rješenja. Sitne
izmjene idu samo u `06-CHANGELOG.md`.

Poenta ADR-a nije da opiše šta je urađeno (to je changelog), nego **zašto je
odbačeno ono što nije urađeno**. Za šest mjeseci to je jedina informacija koja se
ne može rekonstruisati iz koda.

## Šablon

```markdown
# ADR-NNNN — Naslov

**Datum:** YYYY-MM-DD
**Status:** predloženo | prihvaćeno | zamijenjeno ADR-NNNN | odbačeno

## Kontekst
Šta je situacija koja traži odluku. Bez rješenja — samo problem i ograničenja.

## Razmotrene opcije
Za svaku: kako bi radila, šta dobijamo, šta gubimo.

## Odluka
Šta je izabrano i koji je presudni razlog.

## Posljedice
Šta se sad mijenja u radu — dobre i loše strane koje prihvatamo.
Šta ovo zatvara kao mogućnost.
```

## Registar

| # | Odluka | Status | Datum |
|---|---|---|---|
| [0001](ADR-0001-lokalni-supabase.md) | Lokalni Supabase u Dockeru sa šemom u gitu | prihvaćeno | 2026-07-25 |
