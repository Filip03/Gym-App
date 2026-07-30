import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { getMessaging, getToken, Messaging, onMessage } from 'firebase/messaging';
import { SupabaseService } from './supabase_service';
import { environment } from '../../environments/env';

// Odvojen scope od Angularovog service workera (ngsw-worker.js drži "/") —
// vidi napomenu u firebase-messaging-sw.js.
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private app: FirebaseApp = initializeApp(environment.firebase);
  private messaging: Messaging | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  constructor(private supabase: SupabaseService) {}

  // Poziva se poslije uspješnog logina. Namjerno ne baca grešku — ako korisnik
  // odbije dozvolu ili browser ne podržava push, prijava i dalje mora proći.
  async registerForPush(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

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
  async unregisterFromPush(): Promise<void> {
    try {
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
}
