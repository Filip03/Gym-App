# ASCII more — landing splash (arhiviran dizajn)

**Status:** zamijenjen na main-u Filipovim „Pljesak krede" splashom (avgust 2026),
ali sačuvan ovdje jer je Marku bio izuzetno drag („meni baš baš premoćan").
Ukusi se nisu poklopili — legitimno; dizajn se čuva za ponovnu upotrebu.

## Koncept

More od ASCII znakova preko cijelog ekrana iz kojeg izranja identitet:

1. More se budi iz praznine (amplituda i gustina rastu), implozija ka centru.
2. Logo izranja kućnim tečnim jezikom (squash & stretch + ink-bloom kap +
   prsten), voda se razmakne oko identiteta (elipsa).
3. Natpis „JEBA NE SMIJE DA STANE" se dekodira iz šuma slijeva nadesno
   (sci-fi registar kao glitch efekti).
4. Instrument-mjerač „ZAGRIJAVANJE [#####-----]" se puni do preusmjerenja.
5. Izlaz: udar iz centra, amplituda nabuja, identitet potone (ink-retreat).

## Tehnika (vrijedna ponovne upotrebe — koristi je i glitch v3 talas)

- Dva `<pre>` sloja (mirna voda + volt grebeni), po kadru se upisuju samo dva
  `textContent`-a — nijedan DOM čvor se ne pravi.
- rAF ~30fps VAN Angular zone; sinusi po koloni/redu (ne po ćeliji) preko
  sin(a+b) razlaganja; Float32Array pomoćni nizovi. ~0,07ms po kadru.
- Mreža se MJERI lenjirom od 20 „M" (ne pretpostavlja se širina znaka).
- Obje teme (svijetla: tamnozeleni znakovi, bez glowa); reduced-motion =
  statičan kadar.

## Gdje živi kod

Fajlovi u ovom folderu su snapshot sa commita `4e16be2` (grana XFactor).
Jezik znakova dalje živi u `glitch-overlay` komponenti (ASCII talas efekata).
