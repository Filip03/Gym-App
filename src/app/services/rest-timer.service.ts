import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { environment } from '../../environments/env';

const ENABLED_KEY = 'gymapp.restTimerEnabled';
const MINUTES_KEY = 'gymapp.restTimerMinutes';
const DEFAULT_MINUTES = 2;

/**
 * Tajmer pauze između serija. Poziva se poslije svakog upisa — svaki novi upis
 * RESETUJE odbrojavanje (jedan aktivan tajmer, ne gomila se). Trajanje pauze
 * je podesivo (podrazumijevano 2 minuta), pamti se po uređaju.
 *
 * Notifikacija se zakazuje na BACKENDU (prava FCM push poruka), ne lokalnim
 * setTimeout-om u browseru — lokalni tajmer prestaje da radi kad se telefon
 * zaključa/app zatvori (pogotovo na iPhone-u), a push stiže i tad.
 */
@Injectable({ providedIn: 'root' })
export class RestTimerService {
  enabled = localStorage.getItem(ENABLED_KEY) !== 'off';
  minutes = Number(localStorage.getItem(MINUTES_KEY)) || DEFAULT_MINUTES;

  /**
   * LOKALNO odbrojavanje, prikazano na ekranu treninga. Nezavisno od push
   * notifikacije sa backenda: notifikacija pokriva zaključan telefon, a ovo
   * odgovara na „da li tajmer uopšte teče i koliko je ostalo" dok se u
   * aplikaciju gleda. Živi samo u memoriji — restart pri svakoj seriji.
   */
  private deadline: number | null = null;

  /** „1:47" dok teče; „0:00" tačno na isteku; null kad ne teče. */
  get remainingLabel(): string | null {
    if (!this.deadline) return null;
    const ms = this.deadline - Date.now();
    if (ms <= -3000) return null;   // 3 s poslije isteka natpis se sam skloni
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  get expired(): boolean {
    return !!this.deadline && Date.now() >= this.deadline;
  }

  constructor(private supabase: SupabaseService) {}

  async toggle(): Promise<void> {
    this.enabled = !this.enabled;
    localStorage.setItem(ENABLED_KEY, this.enabled ? 'on' : 'off');

    if (!this.enabled) {
      await this.cancel();
    }
  }

  setMinutes(value: number): void {
    this.minutes = Math.min(30, Math.max(1, Math.round(value) || DEFAULT_MINUTES));
    localStorage.setItem(MINUTES_KEY, String(this.minutes));
  }

  // Poziva se poslije svakog upisa serije. Backend otkazuje prethodno zakazano
  // slanje za ovog korisnika (ako postoji) i zakazuje novo, tačno `minutes` unaprijed.
  async restart(): Promise<void> {
    if (!this.enabled) return;

    // Lokalni sat kreće ODMAH — i kad backend nije dostupan (CORS, hladan
    // start), odbrojavanje na ekranu radi.
    this.deadline = Date.now() + this.minutes * 60_000;

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) return;

      await fetch(`${environment.apiBaseUrl}/api/notifications/rest-timer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ minutes: this.minutes })
      });
    } catch (err) {
      console.warn('Zakazivanje tajmera pauze nije uspjelo:', err);
    }
  }

  async cancel(): Promise<void> {
    this.deadline = null;

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) return;

      await fetch(`${environment.apiBaseUrl}/api/notifications/rest-timer`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (err) {
      console.warn('Otkazivanje tajmera pauze nije uspjelo:', err);
    }
  }

  private async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.client.auth.getSession();
    return data.session?.access_token ?? null;
  }
}
