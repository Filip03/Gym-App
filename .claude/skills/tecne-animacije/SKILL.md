---
name: tecne-animacije
description: Kućni jezik pokreta GymApp-a — „tečno/mastilo": squash & stretch, ink-bloom kap, sadržaj koji izranja talasom. Učitati pri SVAKOM pravljenju ili izmjeni UI animacija, interakcija ili promjena stanja elemenata.
---

# Tečne animacije — jezik pokreta GymApp-a

Sve promjene stanja UI elemenata animiraju se „tečnim/mastilo" jezikom.
Ovo je izričita želja vlasnika projekta i kućno pravilo.

## Tri sastojka (kombinuju se, u istom taktu)

1. **Squash & stretch** — element se pri promjeni blago razlije: stisne po
   visini dok se isteže (~5%), pa se slegne. Easing: `var(--ease-spring)`.
   Trajanje ~460–520 ms. Za suprotni smjer (gašenje/skupljanje) obrnuti
   redoslijed (`island-sip` obrazac).

2. **Ink-bloom** — kap akcentne boje (`--volt-a20`; za „događaj" jače:
   `--volt-a40`) krene iz tačke interakcije (ikona, dodir), razlije se kroz
   element i izblijedi. Izvedba: `::after` krug, `scale(0) → scale(~24)` uz
   pad opacity, ~560 ms. Obrnuto (`ink-retreat`): kap se povuče nazad u tačku.

3. **Talas sadržaja** — djeca ulaze odozdo (`translateY(0.5em)` + fade,
   `ease-spring`), svako sa koracima kašnjenja: elementi ~70–120 ms razmaka,
   slova ~22 ms po slovu (split-flap). Pri listanju unazad kašnjenja teku
   obrnutim redom.

## Obavezna pravila

- **Svako stanje i SVAKI prelaz pokriven animacijom** — nacrtaj lanac stanja
  elementa i provjeri da svaki prelaz ima pokret, uključujući povratne i
  timeout prelaze (npr. odbrojavanje → istek → povratak). Nijedan trenutni
  preskok sadržaja ili funkcije.
- `prefers-reduced-motion: reduce` gasi SVE (animation i transition).
- CSS ne svira animaciju na uklanjanju klase — za izlazne prelaze komponenta
  drži kratko stanje (npr. `tiClosing`, ~480 ms pa reset).

## Zamke naučene u praksi

- Flex stavka ima `min-width: auto` — bez `min-width: 0` nikad se ne skuplja
  kroz `max-width: 0`.
- `width/height: auto` se ne animira — koristiti `max-width`/`max-height` ili
  transform.
- Animacija ulaska ide na omotač, ne na spojene polovine elementa (zajednički
  `transform`), inače se spoj raspadne.
- Novo rađanje sadržaja: `*ngFor="let k of [key]"` trik — promjena ključa
  ponovo rodi element pa ulazna animacija odsvira.

## Referentne implementacije

- `src/app/components/training/training.component.scss` — `.timer-island`
  (razliv, kap, sip/retreat, faze kroz `watchTimerPhase`)
- `src/app/components/dashboard/dashboard.component.scss` — split-flap natpis
  velikog dugmeta (talas po slovima, smjer, `faceKey`/`outFace`)
