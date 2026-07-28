import { Injectable } from '@angular/core';

/**
 * Red čekanja za upise koji nisu prošli zbog mreže.
 *
 * ZAŠTO POSTOJI
 *
 * Teretane imaju loš signal — podrum, betonski zidovi, zauzeta ćelija. Do sada
 * je pad mreže značio crvenu poruku i **izgubljenu seriju**: čovjek je odradio
 * set, otkucao brojeve, a aplikacija ih nije zapamtila nigdje.
 *
 * Sada se takav upis odlaže u `localStorage` i šalje čim mreža proradi.
 *
 * ŠTA SE ODLAŽE, A ŠTA NE
 *
 * Odlažu se samo **upisi serija**. Oni su jedina radnja koja se dešava usred
 * treninga, sa telefonom u ruci, i jedina koju je nemoguće ponoviti kasnije po
 * sjećanju. Brisanje serije, zamjena vježbe i preređivanje se NE odlažu — te
 * radnje mijenjaju stanje koje bi se pri kasnijoj sinhronizaciji moglo sudariti
 * sa stvarnim stanjem baze, a nisu hitne.
 *
 * ZAŠTO `localStorage`, A NE IndexedDB
 *
 * Red je mali (nekoliko desetina redova od stotinjak bajtova) i piše se rijetko
 * — jednom po seriji. IndexedDB bi ovdje bio asinhroni sloj bez ijedne koristi.
 *
 * REDOSLIJED SE ČUVA
 *
 * Šalje se jedan po jedan, redom kojim je upisano. `set_number` zavisi od
 * prethodnih serija, pa bi paralelno slanje umjelo da ih ispremješta.
 */

/** Jedan odloženi upis serije. */
export interface QueuedSet {
  /** Lokalni ključ — da se isti upis ne pošalje dvaput. */
  id: string;
  userId: string;
  sessionId: string;
  exerciceId: string;
  planId: string | null;
  date: string;
  setNumber: number;
  reps: number;
  weight: number;
  /** Strana kod jednoručnih vježbi; null = obje ruke zajedno. */
  side: 'L' | 'D' | null;
  /** Kad je upisano na telefonu, za prikaz „čeka od…". */
  queuedAt: string;
}

const STORAGE_KEY = 'gymapp.queue.sets';

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {

  /** Da li smo trenutno na mreži. Prati `online`/`offline` događaje. */
  online = navigator.onLine;

  /** Koliko upisa čeka slanje. Komponente ovo prikazuju. */
  pending = 0;

  /** Poziva se kad red uspješno isprazni bar jedan upis — da ekran osvježi. */
  onFlushed: (() => void) | null = null;

  /** Funkcija koja stvarno šalje upis. Postavlja je `TrainingService`. */
  private sender: ((entry: QueuedSet) => Promise<unknown>) | null = null;
  private flushing = false;

  constructor() {
    this.pending = this.read().length;

    window.addEventListener('online', () => {
      this.online = true;
      void this.flush();
    });
    window.addEventListener('offline', () => { this.online = false; });
  }

  /** `TrainingService` prijavljuje kako se upis šalje — servis ne poznaje bazu. */
  registerSender(fn: (entry: QueuedSet) => Promise<unknown>) {
    this.sender = fn;
    if (this.pending > 0) void this.flush();
  }

  /** Dodaje upis u red. Vraća ono što je zapamćeno. */
  enqueue(entry: Omit<QueuedSet, 'id' | 'queuedAt'>): QueuedSet {
    const queued: QueuedSet = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      queuedAt: new Date().toISOString()
    };

    const all = this.read();
    all.push(queued);
    this.write(all);

    return queued;
  }

  /** Upisi koji čekaju za dati trening — da se prikažu u listi serija. */
  forSession(sessionId: string): QueuedSet[] {
    return this.read().filter(q => q.sessionId === sessionId);
  }

  /**
   * Šalje sve što čeka, jedan po jedan.
   *
   * Zaustavlja se na prvoj grešci i ostavlja ostatak u redu — ako je mreža i
   * dalje loša, nema smisla mlatiti kroz cio red i trošiti bateriju.
   */
  async flush(): Promise<void> {
    if (this.flushing || !this.sender || !navigator.onLine) return;

    let all = this.read();
    if (all.length === 0) return;

    this.flushing = true;
    let sent = 0;

    try {
      while (all.length > 0) {
        const entry = all[0];

        try {
          await this.sender(entry);
        } catch {
          break;   // mreža i dalje ne radi — ostatak čeka
        }

        all = this.read().filter(q => q.id !== entry.id);
        this.write(all);
        sent++;
      }
    } finally {
      this.flushing = false;
    }

    if (sent > 0) this.onFlushed?.();
  }

  /** Briše odloženi upis (npr. korisnik obriše seriju prije nego što ode). */
  remove(id: string) {
    this.write(this.read().filter(q => q.id !== id));
  }

  // ---------------------------------------------------------------------------

  private read(): QueuedSet[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Neispravan sadržaj (ručna izmjena, puna memorija) ne smije da obori
      // aplikaciju — bolje prazan red nego bijeli ekran.
      return [];
    }
  }

  private write(all: QueuedSet[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Memorija puna — upis se gubi, ali aplikacija radi dalje.
    }
    this.pending = all.length;
  }
}
