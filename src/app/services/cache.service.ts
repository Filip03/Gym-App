import { Injectable } from '@angular/core';

/**
 * Stale-while-revalidate keš u `localStorage`.
 *
 * ZAŠTO POSTOJI
 *
 * Svaki ulazak na tab je do sada značio spinner i čekanje na server — na
 * mobilnoj vezi u teretani i po 10–20 sekundi (Markova prijava). A podaci koji
 * se čekaju su iz minuta u minut praktično isti: katalog vježbi, šifarnici,
 * planovi, struktura današnjeg treninga.
 *
 * Zato se posljednji uspješan odgovor pamti ovdje, pa ekran PRVI PIKSEL crta
 * iz keša, sinhrono, bez ijednog odlaska na server — a svjež podatak se
 * svejedno dovuče u pozadini i tiho dopuni prikaz. Zastarjelost je zato
 * bezopasna: nikad nije KRAJNJE stanje, samo prvi kadar.
 *
 * ŠTA NE SMIJE OVAMO
 *
 * Podaci kod kojih bi i kratka zastarjelost lagala: upisane serije
 * (`getSessionLogs` — izvor istine), „trenira sada", sat sesije, pragovi
 * ličnih rekorda (lažno slavlje je neprihvatljivo). Njih uvijek nosi mreža.
 *
 * KLJUČEVI
 *
 * `gymapp.cache.<verzija>.<domen>.<userId|global>` — vlasnik je OBAVEZAN dio
 * ključa kad su podaci lični (telefon dijele Marko i Filip: tuđi planovi kao
 * „moji" bili bi gori kvar od praznog keša). Verzija šeme je u ključu: kad se
 * oblik keširanog objekta promijeni, podigne se verzija i stari zapisi se
 * prosto više ne čitaju (konstruktor ih počisti).
 *
 * Isti obrazac otpornosti kao `offline-queue.service.ts` i `draft.service.ts`:
 * puna memorija (QuotaExceededError) i neispravan JSON NIKAD ne ruše
 * aplikaciju — keš je ukras performansi, ne podatak.
 */

/** Prefiks svih zapisa — po njemu se prepoznaju i stare verzije pri čišćenju. */
const PREFIX = 'gymapp.cache';

/** Verzija ŠEME keša. Podići čim se oblik bilo kog keširanog objekta promijeni. */
const SCHEMA = 'v1';

/** Omot oko podatka — pamti kad je upisan, da `peek` može odbiti prestaro. */
interface CacheEnvelope<T> {
  /** ISO vrijeme upisa. */
  at: string;
  data: T;
}

// TTL-ovi su namjerno velikodušni: keš služi samo za prvi kadar, a tiho
// osvježenje UVIJEK slijedi — prestrog TTL bi samo vraćao spinner.
export const TTL_30MIN = 30 * 60_000;
export const TTL_1H = 60 * 60_000;
export const TTL_6H = 6 * 60 * 60_000;
export const TTL_24H = 24 * 60 * 60_000;
export const TTL_7D = 7 * 24 * 60 * 60_000;

@Injectable({ providedIn: 'root' })
export class CacheService {

  constructor() {
    this.pruneOtherVersions();
  }

  /**
   * SINHRONO vraća keširan podatak ako postoji i nije stariji od `maxAgeMs`.
   *
   * Sinhrono je poenta: komponenta ga zove na vrhu `ngOnInit` i crta PRIJE
   * ijednog odlaska na server. Prestar ili neispravan zapis se briše i vraća
   * se `null` — kao da keša nema.
   */
  peek<T>(key: string, maxAgeMs: number): T | null {
    let raw: string | null = null;

    try {
      raw = localStorage.getItem(this.storageKey(key));
    } catch {
      return null;
    }

    if (!raw) return null;

    try {
      const envelope = JSON.parse(raw) as CacheEnvelope<T>;
      if (!envelope || envelope.data === undefined) { this.remove(key); return null; }

      const age = Date.now() - new Date(envelope.at).getTime();
      if (!isFinite(age) || age < 0 || age > maxAgeMs) { this.remove(key); return null; }

      return envelope.data;
    } catch {
      // Neispravan sadržaj (ručna izmjena, prekinut upis) = kao da keša nema.
      this.remove(key);
      return null;
    }
  }

  /** Pamti svjež odgovor. Zovu ga servisi po svakom uspješnom dovlačenju. */
  put<T>(key: string, data: T): void {
    const raw = JSON.stringify({ at: new Date().toISOString(), data } satisfies CacheEnvelope<T>);
    const storageKey = this.storageKey(key);

    try {
      localStorage.setItem(storageKey, raw);
    } catch {
      // Memorija puna (QuotaExceededError) ili privatni režim. Keš je jedini
      // stanovnik localStorage-a koji se smije žrtvovati — red čekanja i
      // nacrti se NE diraju. Počisti sve svoje zapise pa pokušaj još jednom;
      // ako ni tada ne prođe, aplikacija radi dalje bez keša.
      this.clear('');
      try {
        localStorage.setItem(storageKey, raw);
      } catch {
        // Nema šta dalje — sljedeći ekran će prosto ići preko mreže.
      }
    }
  }

  /**
   * Briše sve zapise čiji ključ (poslije verzije) počinje datim prefiksom.
   * `clear('training.session')` odnese strukturu sesije svih korisnika;
   * `clear('')` odnese CIO keš (i samo keš — tuđi `gymapp.*` prefiksi ostaju).
   */
  clear(prefix: string): void {
    this.removeWhere(k => k.startsWith(`${PREFIX}.${SCHEMA}.${prefix}`));
  }

  /**
   * Briše SVE lične zapise datog korisnika — ključeve koji se završavaju
   * na `.<userId>`. Zove se pri odjavi: sljedeća prijava na istom telefonu
   * može biti tuđa, a globalni katalog slobodno ostaje.
   */
  clearUser(userId: string): void {
    if (!userId) return;
    this.removeWhere(k => k.startsWith(`${PREFIX}.${SCHEMA}.`) && k.endsWith(`.${userId}`));
  }

  // ---------------------------------------------------------------------------

  private storageKey(key: string): string {
    return `${PREFIX}.${SCHEMA}.${key}`;
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(this.storageKey(key));
    } catch {
      // Zapis će isteći sam.
    }
  }

  private removeWhere(match: (storageKey: string) => boolean): void {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && match(k)) doomed.push(k);
      }
      doomed.forEach(k => localStorage.removeItem(k));
    } catch {
      // Čišćenje je higijena, ne funkcija.
    }
  }

  /** Zapisi starih verzija šeme se nikad neće pročitati — nema razloga da stoje. */
  private pruneOtherVersions(): void {
    const keep = `${PREFIX}.${SCHEMA}.`;
    this.removeWhere(k => k.startsWith(`${PREFIX}.`) && !k.startsWith(keep));
  }
}
