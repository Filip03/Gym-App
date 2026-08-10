import { Injectable } from '@angular/core';

/**
 * Nacrti nedovršenih formi.
 *
 * ZAŠTO POSTOJI
 *
 * Plan se pravi u modalu koji drži sve u memoriji komponente: naziv, opis, tip,
 * sedam dana sa izabranim vježbama. Dovoljno je zatvoriti modal, primiti poziv
 * ili da telefon ubije karticu — i sve to nestane. Isto važi za bilješku uz
 * trening: otkucaš je, izađeš sa ekrana, nema je.
 *
 * Ovdje se takvo stanje odlaže u `localStorage` i vraća kad se korisnik vrati.
 * Servis NE zna šta čuva — komponenta mu daje običan objekat, on ga vrati
 * onakvog kakvog je dobio.
 *
 * KLJUČEVI
 *
 * `gymapp.draft.<verzija>.<ime>.<vlasnik>` — vlasnik je userId (nacrt plana) ili
 * sessionId (bilješka), da se nacrti dvojice na istom telefonu ne pomiješaju.
 * Verzija šeme je U KLJUČU: kad se oblik nacrta promijeni, dovoljno je podići
 * verziju i stari nacrti se prosto više ne čitaju (a `prune` ih očisti).
 *
 * ZAŠTO `localStorage`, A NE IndexedDB
 *
 * Isti razlog kao kod reda čekanja (`offline-queue.service.ts`): nacrt je jedan
 * mali objekat koji se piše najviše par puta u sekundi. IndexedDB bi ovdje bio
 * asinhroni sloj bez ijedne koristi.
 */

/** Prefiks svih nacrta — po njemu se prepoznaju i stare verzije pri čišćenju. */
const PREFIX = 'gymapp.draft';

/**
 * Verzija ŠEME nacrta. Podići je čim se oblik sačuvanog objekta promijeni tako
 * da stari nacrt više ne bi mogao ispravno da se vrati u formu.
 */
const SCHEMA = 'v1';

/** Omot oko podatka — pamti kad je upisan, da se stari nacrt ne nudi zauvijek. */
interface DraftEnvelope<T> {
  v: string;
  /** ISO vrijeme posljednjeg upisa. */
  at: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class DraftService {

  /** Odgođeni upisi po ključu — vidi `saveDebounced`. */
  private timers = new Map<string, any>();

  constructor() {
    this.pruneOtherVersions();
  }

  /** Upisuje nacrt ODMAH. */
  save<T>(key: string, data: T): void {
    this.cancelPending(key);

    const envelope: DraftEnvelope<T> = {
      v: SCHEMA,
      at: new Date().toISOString(),
      data
    };

    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(envelope));
    } catch {
      // Memorija puna (QuotaExceededError) ili privatni režim — nacrt se gubi,
      // ali forma radi dalje. Isti obrazac kao u offline-queue.service.ts.
    }
  }

  /**
   * Upisuje nacrt tek kad se kucanje smiri.
   *
   * Bez ovoga bi svaki pritisnut taster išao u `localStorage`, a on je
   * sinhroni upis — na telefonu se to osjeti kao zapinjanje pri kucanju.
   */
  saveDebounced<T>(key: string, data: T, delayMs: number): void {
    this.cancelPending(key);
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      this.save(key, data);
    }, delayMs));
  }

  /**
   * Vraća nacrt ako postoji i nije stariji od `maxAgeMs`. Prestar se briše —
   * niko ne želi da mu se poslije mjesec dana nudi zaboravljeni plan.
   */
  load<T>(key: string, maxAgeMs: number): T | null {
    let raw: string | null = null;

    try {
      raw = localStorage.getItem(this.storageKey(key));
    } catch {
      return null;
    }

    if (!raw) return null;

    try {
      const envelope = JSON.parse(raw) as DraftEnvelope<T>;
      if (!envelope || envelope.v !== SCHEMA) { this.clear(key); return null; }

      const age = Date.now() - new Date(envelope.at).getTime();
      if (!isFinite(age) || age < 0 || age > maxAgeMs) { this.clear(key); return null; }

      return envelope.data ?? null;
    } catch {
      // Neispravan sadržaj (ručna izmjena, prekinut upis) ne smije da obori
      // ekran — bolje bez nacrta nego bijeli ekran.
      this.clear(key);
      return null;
    }
  }

  /** Briše nacrt i otkazuje odgođeni upis koji bi ga vratio. */
  clear(key: string): void {
    this.cancelPending(key);
    try {
      localStorage.removeItem(this.storageKey(key));
    } catch {
      // Nema šta da se radi — nacrt će isteći sam.
    }
  }

  // ---------------------------------------------------------------------------

  private storageKey(key: string): string {
    return `${PREFIX}.${SCHEMA}.${key}`;
  }

  private cancelPending(key: string) {
    const t = this.timers.get(key);
    if (t) {
      clearTimeout(t);
      this.timers.delete(key);
    }
  }

  /** Nacrti starih verzija šeme se nikad neće pročitati — nema razloga da stoje. */
  private pruneOtherVersions() {
    try {
      const keep = `${PREFIX}.${SCHEMA}.`;
      const stale: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${PREFIX}.`) && !k.startsWith(keep)) stale.push(k);
      }

      stale.forEach(k => localStorage.removeItem(k));
    } catch {
      // Čišćenje je higijena, ne funkcija — tiho se odustaje.
    }
  }
}
