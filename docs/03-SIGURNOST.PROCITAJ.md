# 03 — Sigurnost (dokument nije u repou)

Registar sigurnosnih nalaza postoji kao `docs/03-SIGURNOST.md`, ali je
**namjerno izostavljen iz gita** (`.gitignore`).

## Zašto

Repo je javan. Dokument popisuje konkretne rupe u sistemu koji je **trenutno
živ**, uz tačne nazive tabela, stanje pristupnih prava i način na koji se podaci
mogu izmijeniti ili obrisati. Pristupni ključ aplikacije je javan po prirodi
(šalje se u JS bundle-u), pa bi objavljivanje takvog popisa bilo isto što i
ostaviti uputstvo pored otključanih vrata.

Ovo nije skrivanje problema — problemi su poznati i planirani za rješavanje
(Faza 5 u `04-ROADMAP.md`). Radi se o tome da se ne objavljuju **dok su otvoreni**.

## Kako doći do njega

Traži ga direktno od Marka ili Filipa. Fajl postoji u svakoj lokalnoj kopiji
repoa kod onih koji su ga dobili.

## Kad se vraća u repo

Kad Faza 5 bude završena i rupe zatvorene, dokument gubi opasnost i može se
commit-ovati kao istorijski zapis — tada se ukloni iz `.gitignore`.

## Šta jeste javno

Sve ostalo. Šema baze, popis bugova (`02-STANJE-KODA.md`), konvencije, changelog
i migracije nemaju exploit vrijednost — opisuju kvalitet koda i korisnički
doživljaj, ne način pristupa podacima.
