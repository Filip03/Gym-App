import { Injectable } from '@angular/core';

/**
 * Zaključava strelicu "nazad" u headeru dok je korisnik usred neke edit
 * radnje na trening ekranu (dodavanje/zamjena vježbe, preuređivanje,
 * bilješka, ciljevi...) — da se ne izađe slučajno iz treninga nedovršenih
 * izmjena.
 *
 * Header čita `locked` direktno u templateu; Angular ponovo provjerava taj
 * izraz pri svakom sljedećem ciklusu provjere promjena (npr. bilo koji klik),
 * pa ne treba nikakav Observable za ovako jednostavno dijeljeno stanje.
 */
@Injectable({ providedIn: 'root' })
export class NavLockService {
  locked = false;

  lock() { this.locked = true; }
  unlock() { this.locked = false; }
}
