import { isDevMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

// Tema se primjenjuje PRIJE bootstrapa — inače svijetli korisnik pri svakom
// otvaranju vidi bljesak tamne teme dok se Angular podiže.
document.documentElement.setAttribute(
  'data-theme',
  localStorage.getItem('gymapp.theme') === 'light' ? 'light' : 'dark'
);


/**
 * U razvoju se skida svaki zaostali service worker.
 *
 * `ServiceWorkerModule` se registruje samo u produkciji (`enabled: !isDevMode()`),
 * ali to skida SAMO registrovanje novog — već registrovan worker ostaje i dalje
 * poslužuje stranicu iz svog keša. Telefon onda pokazuje staru verziju iako dev
 * server servira novu, i nikakvo osvježavanje ne pomaže jer zahtjev do servera
 * ni ne stigne.
 *
 * Do toga se lako dođe pri probanju na telefonu preko LAN adrese: dovoljno je da
 * je ta ista adresa jednom poslužila produkcijski build.
 */
if (isDevMode() && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations()
    .then(regs => {
      // SAMO Angularov ngsw! Firebase-ov messaging worker se registruje u toku
      // rada (dozvola za notifikacije) — brisati njega znači: registracija →
      // reload → brisanje → registracija... beskonačna petlja osvježavanja.
      const ngsw = regs.filter(r =>
        [r.active, r.installing, r.waiting]
          .some(w => w?.scriptURL.includes('ngsw-worker.js')));
      return Promise.all(ngsw.map(r => r.unregister()));
    })
    .then(unregistered => {
      // Keš preživi odjavu workera, pa se briše zasebno — ali samo ngsw keševi.
      if (unregistered.some(Boolean) && 'caches' in window) {
        return caches.keys()
          .then(keys => Promise.all(keys.filter(k => k.startsWith('ngsw:')).map(k => caches.delete(k))))
          .then(() => location.reload());
      }
      return undefined;
    })
    .catch(() => { /* bez ovoga se može — samo je probanje na telefonu nezgodnije */ });
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
