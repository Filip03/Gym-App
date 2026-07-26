import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { ExerciceService, MuscleGroupWithExercices } from './exercice.service';
import { ProfileService } from './profile.service';

/**
 * Podaci za ekran „Ekipa" (ranije „Leaderboard").
 *
 * KAKO SE RANGIRA I ZAŠTO BAŠ TAKO
 *
 * Rangira se po **najvećoj kilaži podignutoj u periodu**. Ako dvoje imaju istu
 * kilažu, bolji je onaj ko ju je podigao **više puta**; ako je i to isto, gleda
 * se broj ponavljanja. Ponavljanja ne ulaze u rang, samo se prikazuju.
 *
 * Odbačene su dvije alternative:
 *
 *   procijenjeni 1RM  — pošteniji prema seriji 60×15, ali je izveden broj koji
 *                       niko ne prepoznaje kao svoj rezultat
 *   ukupna kilaža     — mjeri koje su vježbe bile na rasporedu, ne čovjeka
 *
 * PERIOD JE DIO METRIKE, NE FILTER
 *
 * Podrazumijevano se gleda **zadnjih 30 dana**. Poenta je da rekord ne traje
 * zauvijek: ko jednom digne 140 kg i prestane da dolazi, za mjesec dana ispada
 * sa liste. Duži periodi (2, 6, 12 mjeseci) postoje kao istorija — da se vidi
 * čiji je najveći rezultat ikad, ali to nije podrazumijevani pogled.
 *
 * ZATEČENA GREŠKA KOJA JE OVDJE ISPRAVLJENA
 *
 * Raniji upit je imao `.eq('set_number', 1)` i uzimao **posljednji** zapis po
 * datumu. Dvije posljedice: najteža serija se nije vidjela ako nije bila prva u
 * vježbi, a lakši trenažni dan te je prikazivao kao slabijeg nego prošle
 * sedmice. (`A3` u `docs/02-STANJE-KODA.md`.)
 */

export type PeriodDays = 30 | 60 | 180 | 365;

export const PERIODS: { days: PeriodDays; label: string }[] = [
  { days: 30,  label: '30 dana' },
  { days: 60,  label: '2 mjeseca' },
  { days: 180, label: '6 mjeseci' },
  { days: 365, label: 'Godina' }
];

export interface LeaderEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Najveća kilaža u periodu. `null` = nije radio ovu vježbu u periodu. */
  weight: number | null;
  /** Koliko puta je ta kilaža podignuta — prvi kriterijum za neriješeno. */
  times: number;
  /** Najviše ponavljanja na toj kilaži — drugi kriterijum. */
  reps: number;
  /** Kad je ta kilaža prvi put dostignuta. */
  date: string | null;
  /** 1, 2, 3… — dodjeljuje se samo onima koji imaju rezultat. */
  rank: number | null;
}

export interface WeekMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Ponedjeljak → nedjelja tekuće sedmice. */
  days: boolean[];
  count: number;
  /** „danas", „juče", „prije 4 dana", „—". */
  lastLabel: string;
}

export interface RecordEvent {
  userId: string;
  username: string;
  avatarUrl: string | null;
  exerciceId: string;
  exerciceName: string;
  weight: number;
  reps: number;
  date: string;
  /** Kilaža koju je oborio — da se vidi koliko je skočio. */
  prevWeight: number;
  dayLabel: string;
}

interface TeamProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
}

/**
 * Koliko se dana unazad povlači za rekorde.
 *
 * Prvi zapis za neku vježbu unutar prozora nema šta da obori, pa se ne prijavljuje
 * kao rekord. Zato prozor mora biti osjetno duži od onoga što se prikazuje —
 * inače bi svaki povratak na vježbu poslije pauze ispao „rekord".
 */
const RECORD_WINDOW_DAYS = 90;

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {

  /**
   * Spisak članova se ne mijenja tokom sesije, a treba svakoj od tri sekcije i
   * pri svakom dodiru na period. Bez ovoga bi svaka promjena perioda značila
   * još jedan odlazak na server za četiri reda.
   */
  private profilesCache: Promise<TeamProfile[]> | null = null;

  constructor(
    private supabase: SupabaseService,
    private exerciceService: ExerciceService,
    private profileService: ProfileService
  ) {}

  async getExerciceGroups(): Promise<MuscleGroupWithExercices[]> {
    return this.exerciceService.getExercicesGroupedByMuscleGroup();
  }

  // ---------------------------------------------------------------------------
  // Rang po vježbi

  /**
   * Svi članovi ekipe, i oni bez rezultata u periodu.
   *
   * Prazan red je namjeran: kad nas je četvoro, „—" pored svog imena je jasnija
   * poruka nego da te uopšte nema na spisku.
   */
  async getLeaderboard(exerciceId: string, days: PeriodDays): Promise<LeaderEntry[]> {
    const since = this.daysAgo(days);

    const [profiles, logs] = await Promise.all([
      this.allProfiles(),
      this.logsFor(exerciceId, since)
    ]);

    const byUser = new Map<string, { weight: number; times: number; reps: number; date: string }>();

    for (const row of logs) {
      const weight = Number(row.weight ?? 0);
      const reps = Number(row.reps ?? 0);
      if (!weight) continue;

      const best = byUser.get(row.user_id);

      if (!best || weight > best.weight) {
        byUser.set(row.user_id, { weight, times: 1, reps, date: row.date });
        continue;
      }

      if (weight === best.weight) {
        best.times += 1;
        if (reps > best.reps) best.reps = reps;
        if (row.date < best.date) best.date = row.date;   // prvi put kad je dostignuta
      }
    }

    const entries: LeaderEntry[] = profiles.map(p => {
      const best = byUser.get(p.id);
      return {
        userId: p.id,
        username: p.username,
        avatarUrl: p.avatarUrl,
        weight: best?.weight ?? null,
        times: best?.times ?? 0,
        reps: best?.reps ?? 0,
        date: best?.date ?? null,
        rank: null
      };
    });

    entries.sort((a, b) => {
      if (a.weight === null && b.weight === null) return a.username.localeCompare(b.username);
      if (a.weight === null) return 1;
      if (b.weight === null) return -1;

      if (b.weight !== a.weight) return b.weight - a.weight;   // kilaža
      if (b.times !== a.times) return b.times - a.times;       // pa broj puta
      return b.reps - a.reps;                                  // pa ponavljanja
    });

    // Isti rezultat = isto mjesto. Bez ovoga bi dvoje sa 100 kg × 3 puta bili
    // prikazani kao 1. i 2., što u teretani niko ne bi prihvatio.
    let rank = 0;
    let previous: LeaderEntry | null = null;

    entries.forEach((e, i) => {
      if (e.weight === null) { e.rank = null; return; }

      const tied = previous
        && previous.weight === e.weight
        && previous.times === e.times
        && previous.reps === e.reps;

      rank = tied ? rank : i + 1;
      e.rank = rank;
      previous = e;
    });

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Sedmica ekipe

  /**
   * Ko je trenirao kog dana ove sedmice. Jedina sekcija koja uvijek ima sadržaj.
   *
   * Dan se broji isto kao u kalendaru profila: bar jedna upisana serija, ili
   * izričito završen trening. Sam red u `workout_sessions` nije dovoljan — on
   * nastane već pri otvaranju ekrana treninga, pa bi rest day svima svijetlio
   * kao odrađen. Vidi `ProfileService.getTrainingCalendar`.
   */
  async getTeamWeek(): Promise<WeekMember[]> {
    const monday = this.mondayOfThisWeek();
    const week = Array.from({ length: 7 }, (_, i) => this.isoAfter(monday, i));

    const since = this.isoAfter(monday, -60);   // i ranije, za „posljednji trening"

    const [profiles, sessions, logs] = await Promise.all([
      this.allProfiles(),
      this.sessionsSince(since),
      this.logDatesSince(since)
    ]);

    const datesByUser = new Map<string, Set<string>>();
    const add = (userId: string, date: string) => {
      const set = datesByUser.get(userId) ?? new Set<string>();
      set.add(date);
      datesByUser.set(userId, set);
    };

    for (const s of sessions) add(s.user_id, s.date);
    for (const l of logs) add(l.user_id, l.date);

    const today = this.todayIso();

    return profiles.map(p => {
      const dates = datesByUser.get(p.id) ?? new Set<string>();
      const days = week.map(d => dates.has(d));

      const last = [...dates].filter(d => d <= today).sort().pop() ?? null;

      return {
        userId: p.id,
        username: p.username,
        avatarUrl: p.avatarUrl,
        days,
        count: days.filter(Boolean).length,
        lastLabel: this.agoLabel(last)
      };
    }).sort((a, b) => b.count - a.count || a.username.localeCompare(b.username));
  }

  // ---------------------------------------------------------------------------
  // Feed rekorda

  /**
   * Svaka kilaža koja je u zadnja tri mjeseca oborila prethodnu, najnovija prva.
   *
   * Vraća se cio spisak, bez sječenja. Prozor je namjerno ograničen na 90 dana:
   * bez toga bi se pri svakom otvaranju ekrana povlačila cijela istorija.
   */
  async getRecords(): Promise<RecordEvent[]> {
    const [profiles, logs, names] = await Promise.all([
      this.allProfiles(),
      this.allLogsSince(this.daysAgo(RECORD_WINDOW_DAYS)),
      this.exerciceNames()
    ]);

    const profileById = new Map(profiles.map(p => [p.id, p]));

    // Redoslijed je bitan: zapis je rekord samo u odnosu na ono što mu prethodi.
    const sorted = [...logs].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : Number(a.set_number) - Number(b.set_number)
    );

    const bestSoFar = new Map<string, number>();
    const events: RecordEvent[] = [];

    for (const row of sorted) {
      const weight = Number(row.weight ?? 0);
      if (!weight) continue;

      const key = `${row.user_id}|${row.exercice_id}`;
      const prev = bestSoFar.get(key);

      if (prev === undefined) {
        bestSoFar.set(key, weight);
        continue;   // prvi put ova vježba — nema šta da se obori
      }

      if (weight <= prev) continue;
      bestSoFar.set(key, weight);

      const profile = profileById.get(row.user_id);
      if (!profile) continue;

      events.push({
        userId: row.user_id,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        exerciceId: row.exercice_id,
        exerciceName: names.get(row.exercice_id) ?? 'Vježba',
        weight,
        reps: Number(row.reps ?? 0),
        date: row.date,
        prevWeight: prev,
        dayLabel: this.agoLabel(row.date)
      });
    }

    // Najnoviji prvi. Koliko ih se prikazuje odlučuje komponenta — cijeli spisak
    // je ionako mali, pa se prekidač „svi / moji" i „učitaj još" rješavaju bez
    // ijednog novog upita.
    return events.reverse();
  }

  // ---------------------------------------------------------------------------
  // Upiti

  private allProfiles(): Promise<TeamProfile[]> {
    if (!this.profilesCache) {
      this.profilesCache = this.fetchProfiles().catch(err => {
        this.profilesCache = null;   // neuspjeh se ne kešira
        throw err;
      });
    }
    return this.profilesCache;
  }

  private async fetchProfiles(): Promise<TeamProfile[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, username, profile_pic_url')
      .order('username', { ascending: true });

    if (error) throw error;

    return ((data ?? []) as any[]).map(p => ({
      id: p.id as string,
      username: (p.username ?? 'Nepoznat') as string,
      avatarUrl: p.profile_pic_url ? this.profileService.getPublicUrl(p.profile_pic_url) : null
    }));
  }

  private async logsFor(exerciceId: string, since: string) {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('user_id, weight, reps, date')
      .eq('exercice_id', exerciceId)
      .gte('date', since);

    if (error) throw error;
    return (data ?? []) as any[];
  }

  private async allLogsSince(since: string) {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('user_id, exercice_id, weight, reps, date, set_number')
      .gte('date', since);

    if (error) throw error;
    return (data ?? []) as any[];
  }

  /** Samo ZAVRŠENE sesije — vidi objašnjenje u `getTeamWeek`. */
  private async sessionsSince(since: string) {
    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select('user_id, date, finished_at')
      .not('finished_at', 'is', null)
      .gte('date', since);

    if (error) throw error;
    return (data ?? []) as any[];
  }

  /** Dani sa bar jednom upisanom serijom — broje se i bez „Trening gotov". */
  private async logDatesSince(since: string) {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('user_id, date')
      .gte('date', since);

    if (error) throw error;
    return (data ?? []) as any[];
  }

  private async exerciceNames(): Promise<Map<string, string>> {
    const { data, error } = await this.supabase.client
      .from('exercices')
      .select('id, name');

    if (error) throw error;
    return new Map(((data ?? []) as any[]).map(e => [e.id as string, (e.name ?? '') as string]));
  }

  // ---------------------------------------------------------------------------
  // Datumi
  //
  // Sve se računa u lokalnoj zoni i pretvara u `YYYY-MM-DD`, jer je `date` u
  // bazi datum bez vremena. `toISOString()` se ne koristi — on prelazi u UTC,
  // pa uveče kod nas vraća sjutrašnji dan.

  private isoOf(d: Date): string {
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  private todayIso(): string { return this.isoOf(new Date()); }

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return this.isoOf(d);
  }

  private isoAfter(base: Date, days: number): string {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return this.isoOf(d);
  }

  private mondayOfThisWeek(): Date {
    const d = new Date();
    const js = d.getDay();                    // 0 = nedjelja
    d.setDate(d.getDate() - (js === 0 ? 6 : js - 1));
    return d;
  }

  private agoLabel(date: string | null): string {
    if (!date) return '—';

    const today = new Date(`${this.todayIso()}T12:00:00`);
    const then = new Date(`${date}T12:00:00`);
    const days = Math.round((today.getTime() - then.getTime()) / 86400000);

    if (days <= 0) return 'danas';
    if (days === 1) return 'juče';
    if (days < 7) return `prije ${days} dana`;
    if (days < 14) return 'prošle sedmice';
    return date.slice(8, 10) + '.' + date.slice(5, 7) + '.';
  }
}
