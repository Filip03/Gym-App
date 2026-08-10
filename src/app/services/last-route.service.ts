import { Injectable } from '@angular/core';
import { LIVE_WINDOW_H } from '../shared/warmup-grace';

/**
 * Pamti posljednju posjećenu rutu po korisniku, da PWA relaunch (iOS ubije
 * proces → start_url "/" → splash) ne završi na dashboardu nego tamo gdje je
 * korisnik stvarno bio — usred treninga prije svega.
 *
 * Zapis živi u localStorage-u pod ključem `gymapp.lastRoute.<userId>`, kao
 * `{ url, ts }`. Piše ga app.component na svaki NavigationEnd, čita ga landing
 * pri preusmjerenju, a briše odjava.
 */

interface LastRouteRecord {
  url: string;
  ts: number;
}

const KEY_PREFIX = 'gymapp.lastRoute.';

/**
 * Bijela lista — samo ekrani na koje ima smisla vratiti korisnika.
 * Nikad `/` (splash), `/login` ni `/register`.
 */
const REMEMBERED_ROUTES = [
  '/dashboard', '/exercices', '/leaderboard', '/profiles',
  '/blog', '/news', '/training',
];

/** Opšta svježina zapisa: poslije ovoga povratak na staru rutu više ne pomaže. */
const FRESH_MS = 2 * 3_600_000;

@Injectable({ providedIn: 'root' })
export class LastRouteService {

  /**
   * Upiši rutu ako je sa bijele liste. `url` ide CIO, sa query parametrima —
   * `/training?date=...` bez datuma bi bio drugi ekran.
   */
  remember(url: string, userId: string): void {
    const path = url.split(/[?#]/)[0];
    const ok = REMEMBERED_ROUTES.some(r => path === r || path.startsWith(r + '/'));
    if (!ok) return;

    try {
      const rec: LastRouteRecord = { url, ts: Date.now() };
      localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(rec));
    } catch {
      // localStorage pun ili nedostupan — pamćenje rute je udobnost, ne obaveza.
    }
  }

  /**
   * Vrati zapamćenu rutu ako je još svježa, inače null (bajat zapis se briše).
   *
   * Svježina:
   *  - `/training` BEZ `?date` znači „današnji trening" — važi samo ako je
   *    zapis od DANAS i mlađi od LIVE_WINDOW_H sati (ista granica kao
   *    „trenira sada"): sjutra ujutro, ili poslije prozora, to više nije
   *    trening u toku nego bajat ekran.
   *  - `/training` SA `?date` i sve ostale rute: 2 sata.
   */
  consume(userId: string): string | null {
    let rec: LastRouteRecord | null = null;
    try {
      const raw = localStorage.getItem(KEY_PREFIX + userId);
      if (raw) rec = JSON.parse(raw) as LastRouteRecord;
    } catch {
      rec = null;
    }
    if (!rec || typeof rec.url !== 'string' || typeof rec.ts !== 'number') return null;

    const now = Date.now();
    const path = rec.url.split(/[?#]/)[0];
    const liveTraining = path === '/training' && !rec.url.includes('?');

    const fresh = liveTraining
      ? this.sameDay(rec.ts, now) && now - rec.ts < LIVE_WINDOW_H * 3_600_000
      : now - rec.ts < FRESH_MS;

    if (!fresh) {
      this.forget(userId);
      return null;
    }
    return rec.url;
  }

  /** Odjava briše zapis — sljedeći korisnik na istom telefonu kreće čisto. */
  forget(userId: string): void {
    try {
      localStorage.removeItem(KEY_PREFIX + userId);
    } catch {
      // ništa — nema zapisa, nema ni štete
    }
  }

  /** Isti KALENDARSKI dan, po lokalnom satu — ne „unazad 24h". */
  private sameDay(a: number, b: number): boolean {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear()
        && da.getMonth() === db.getMonth()
        && da.getDate() === db.getDate();
  }
}
