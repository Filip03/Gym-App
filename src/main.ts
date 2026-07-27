import { isDevMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';


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
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .then(unregistered => {
      // Keš preživi odjavu workera, pa se briše zasebno.
      if (unregistered.some(Boolean) && 'caches' in window) {
        return caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .then(() => location.reload());
      }
      return undefined;
    })
    .catch(() => { /* bez ovoga se može — samo je probanje na telefonu nezgodnije */ });
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
