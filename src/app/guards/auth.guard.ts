import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Rute koje traže prijavu.
//
// Guard čeka da se sesija razriješi (AuthService.waitForSession) prije nego što
// pusti navigaciju. To rješava dvije stvari odjednom:
//   1. neprijavljen korisnik više ne vidi prazan ekran nego ide na /login,
//   2. prijavljen korisnik preživi refresh stranice — komponenta se ne pokreće
//      dok sesija nije učitana, pa getCurrentUser() u ngOnInit više nije null.
//
// Napomena: ovo je zaštita KORISNIČKOG DOŽIVLJAJA, ne podataka. Podaci se štite
// isključivo u bazi (RLS). Vidi docs/03-SIGURNOST.md.
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = await auth.waitForSession();
  if (user) return true;

  // Zapamti gdje je korisnik htio da ide, da ga nakon prijave vratimo tamo.
  return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

// Rute koje nemaju smisla kad si već prijavljen (/login, /register).
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = await auth.waitForSession();
  if (!user) return true;

  return router.createUrlTree(['/dashboard']);
};
