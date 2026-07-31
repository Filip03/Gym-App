import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { getMessaging, getToken, Messaging, onMessage } from 'firebase/messaging';
import { SupabaseService } from './supabase_service';
import { environment } from '../../environments/env';

// Odvojen scope od Angularovog service workera (ngsw-worker.js drži "/") —
// vidi napomenu u firebase-messaging-sw.js.
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';
const PUSH_PREF_KEY = 'gymapp.pushEnabled';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private app: FirebaseApp = initializeApp(environment.firebase);
  private messaging: Messaging | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  /**
   * Korisnikov izbor U APLIKACIJI, nezavisan od dozvole pregledača. Bez ovoga
   * ne postoji način da se notifikacije isključe (dozvola se u pregledaču ne
   * može programski povući), niti mjesto koje kaže zašto ih nema.
   */
  enabled = localStorage.getItem(PUSH_PREF_KEY) !== 'off';

  constructor(private supabase: SupabaseService) {}

  /**
   * Probna notifikacija — jedini pravi DOKAZ da pristup postoji: status u
   * profilu kaže šta dozvola tvrdi, a ovo pokaže da notifikacija stvarno
   * iskoči. Ide kroz service worker kad postoji (isti put kao prave), inače
   * direktno kroz Notification.
   */
  async testNotification(): Promise<boolean> {
    if (this.permission !== 'granted') return false;
    const opts = {
      body: 'Notifikacije rade — ovako će stizati tajmer pauze.',
      icon: '/assets/icons/icon-192x192.png'
    };
    try {
      const reg = this.registration
        ?? await navigator.serviceWorker?.getRegistration(FCM_SW_SCOPE)
        ?? await navigator.serviceWorker?.getRegistration();
      if (reg) { await reg.showNotification('GymApp', opts); return true; }
      new Notification('GymApp', opts);
      return true;
    } catch {
      return false;
    }
  }

  /** Stanje dozvole pregledača: 'granted' | 'denied' | 'default' | 'unsupported'. */
  get permission(): string {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  }

  /**
   * Uključivanje/isključivanje iz profila. Vraća stanje dozvole poslije
   * pokušaja — profil po njemu ispisuje šta se stvarno desilo (npr. dozvola
   * ODBIJENA u pregledaču se odavde ne može ponovo tražiti).
   */
  async setEnabled(on: boolean): Promise<string> {
    this.enabled = on;
    localStorage.setItem(PUSH_PREF_KEY, on ? 'on' : 'off');

    if (on) {
      await this.registerForPush();
    } else {
      await this.unregisterFromPush();
    }
    return this.permission;
  }

  /**
   * Poziva se pri svakom pokretanju aplikacije (prijavljen korisnik): ako je
   * dozvola već data a prekidač uključen, tiho obnovi registraciju — bez ovoga
   * se token registruje SAMO pri prijavi, pa nov uređaj ili očišćen pregledač
   * ostaju bez notifikacija do sljedećeg ručnog logina.
   */
  async ensureRegistered(): Promise<void> {
    if (!this.enabled || this.permission !== 'granted') return;
    await this.registerForPush();
  }

  // Poziva se poslije uspješnog logina. Namjerno ne baca grešku — ako korisnik
  // odbije dozvolu ili browser ne podržava push, prijava i dalje mora proći.
  // Vremenski ograničeno — na nekim iOS PWA instalacijama getToken()/aktivacija
  // service workera zna da visi zauvijek umjesto da baci grešku.
  async registerForPush(): Promise<void> {
    await PushNotificationService.withTimeout(this.doRegisterForPush(), 10000);
  }

  private async doRegisterForPush(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (!this.enabled) return;   // korisnik ih je ugasio u aplikaciji

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: FCM_SW_SCOPE
      });
      await this.waitUntilActive(registration);
      this.registration = registration;

      this.messaging = getMessaging(this.app);
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: registration
      });
      if (!token) return;

      await this.callBackend('POST', token);

      // Dok je aplikacija otvorena i u fokusu, service worker (onBackgroundMessage)
      // se ne poziva — FCM ide kroz onMessage, pa notifikaciju moramo sami prikazati
      // (inače korisnik ne vidi ništa, poruka samo tiho stigne).
      onMessage(this.messaging, (payload) => {
        const title = payload.notification?.title ?? 'GymApp';
        registration.showNotification(title, {
          body: payload.notification?.body,
          icon: '/assets/icons/icon-192x192.png',
          data: payload.data
        });
      });
    } catch (err) {
      console.warn('FCM registracija nije uspjela:', err);
    }
  }

  // Poziva se PRIJE signOut-a (dok Supabase sesija još važi za Authorization header).
  // Vremenski ograničeno — signOut() čeka ovo, pa ne smije da zaglavi logout
  // ako getToken() na nekim uređajima (primijećeno na iOS-u) nikad ne razriješi.
  async unregisterFromPush(): Promise<void> {
    await PushNotificationService.withTimeout(this.doUnregisterFromPush(), 5000);
  }

  private async doUnregisterFromPush(): Promise<void> {
    try {
      // Poslije osvježavanja stranice servis nema stanje u memoriji, a token i
      // registracija u pregledaču POSTOJE — bez ove obnove bi odjava (i gašenje
      // iz profila) tiho preskočila brisanje tokena, pa bi push stizao i dalje.
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE) ?? null;
      }
      if (!this.messaging && this.registration) {
        this.messaging = getMessaging(this.app);
      }
      if (!this.messaging || !this.registration) return;

      // Bez eksplicitne serviceWorkerRegistration, getToken() bi pao na
      // navigator.serviceWorker.ready — što je ngsw-worker.js (scope "/"), ne naš
      // Firebase SW. Isti registration mora se koristiti svugdje.
      const token = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey,
        serviceWorkerRegistration: this.registration
      });
      if (!token) return;

      await this.callBackend('DELETE', token);
    } catch (err) {
      console.warn('FCM odjava tokena nije uspjela:', err);
    }
  }

  // PushManager.subscribe() (poziva ga interno getToken()) traži AKTIVAN
  // service worker — odmah poslije register() on je često još "installing",
  // što baca "AbortError: Subscription failed - no active Service Worker".
  private waitUntilActive(registration: ServiceWorkerRegistration): Promise<void> {
    if (registration.active) return Promise.resolve();

    const worker = registration.installing || registration.waiting;
    if (!worker) return Promise.resolve();

    return new Promise((resolve) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
      });
    });
  }

  private async callBackend(method: 'POST' | 'DELETE', token: string): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;

    await fetch(`${environment.apiBaseUrl}/api/notifications/register-token`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ token })
    });
  }

  // Garantuje da se poziv razriješi najkasnije za `ms`, bez obzira šta se
  // dešava unutra — koristi se jer neki koraci (getToken, SW aktivacija) znaju
  // da vise zauvijek na pojedinim uređajima umjesto da bace grešku.
  private static withTimeout(promise: Promise<void>, ms: number): Promise<void> {
    return Promise.race([
      promise,
      new Promise<void>(resolve => setTimeout(resolve, ms))
    ]);
  }
}
