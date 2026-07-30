import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { OfflineQueueService } from './offline-queue.service';
import { DashboardService } from './dashboard.service';
import { ExerciceLog, DropsetLog } from '../models/models';

/** Vježba unutar današnjeg treninga, sa svime što ekran treba da prikaže. */
export interface SessionExercice {
  id: string;                       // session_exercices.id
  exerciceId: string;
  name: string;
  picture: string | null;
  orderNum: number;
  targetSets: number | null;
  targetReps: number | null;
  replacedName: string | null;      // naziv vježbe koju je zamijenila
  isExtra: boolean;
  /** Osnovno se radi tjelesnom težinom (zgibovi...) — vidi exercices.is_bodyweight. */
  isBodyweight: boolean;
  /** Prati se svaka ruka odvojeno (L/D) — vidi exercices.is_unilateral. */
  isUnilateral: boolean;
  /** Vježba za noge — L/D opcija tada govori o nogama, ne o rukama. */
  isLegs: boolean;
}

export interface WorkoutSession {
  id: string;
  date: string;
  planId: string | null;
  planName: string | null;
  dayLabel: string | null;
  dayTypeName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /**
   * Bilješka uz TAJ dan treninga.
   *
   * Kolona `note` postoji u `workout_sessions` otkad je tabela napravljena, ali
   * se nigdje nije koristila. Pošto je ključ `UNIQUE (user_id, date)`, bilješka
   * je po danu — jedna po treningu, ne po vježbi.
   */
  note: string | null;
  exercices: SessionExercice[];
}

/** Strana tijela kod jednoručnih vježbi. null = obje ruke zajedno. */
export type Side = 'L' | 'D' | null;

/** Dropset odrađen uz seriju prethodnog treninga. */
export interface EchoDropset {
  reps: number;
  weight: number;
}

/** Rezultat jedne serije iz prethodnog treninga — "duh" u polju za unos. */
export interface EchoSet {
  setNumber: number;
  reps: number;
  weight: number;
  side: Side;
  /** Dropsetovi te serije prošli put, redom kojim su rađeni. */
  dropsets: EchoDropset[];
}

/**
 * Koliko redova najviše povući po vježbi kad se traži prethodni trening.
 *
 * Mora biti veće od broja serija koje neko odradi na jednoj vježbi u jednom
 * danu. Realno je to do desetak; 20 ostavlja prostora. Ko bi u jednom danu
 * upisao više od 20 serija iste vježbe, duh bi mu pokazao prvih 20 — ostatak
 * treninga je i dalje ispravan, samo se ne bi vidio kao duh.
 */
const ECHO_ROW_LIMIT = 20;

export interface Echo {
  date: string;
  sets: EchoSet[];
}

@Injectable({
  providedIn: 'root'
})
export class TrainingService {

  constructor(
    private supabase: SupabaseService,
    private dashboardService: DashboardService,
    private queue: OfflineQueueService
  ) {
    // Red čekanja ne poznaje bazu — ovdje mu se kaže kako se upis stvarno šalje.
    // Registruje se i pri pokretanju aplikacije, pa se zaostali upisi iz
    // prethodne sesije pošalju čim ima mreže, i bez otvaranja ekrana treninga.
    this.queue.registerSender(entry => this.insertLog({
      userId: entry.userId,
      sessionId: entry.sessionId,
      exerciceId: entry.exerciceId,
      planId: entry.planId,
      date: entry.date,
      setNumber: entry.setNumber,
      reps: entry.reps,
      weight: entry.weight,
      side: entry.side ?? null
    }));
  }

  // -------------------------------------------------------------------------
  // Plan
  // -------------------------------------------------------------------------

  // Praćen tuđi plan ima prioritet (max jedan zbog unique constraint-a na
  // plan_members.profile_id). Ako korisnik ne prati nikog, koristi se sopstveni:
  // jedini ako ga ima samo jedan, inače onaj označen kao aktivan.
  async getPlanForUser(userId: string) {
    const { data: membership, error: memberError } = await this.supabase.client
      .from('plan_members')
      .select('plan_id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (memberError) throw memberError;
    if (membership) return this.dashboardService.getFullPlan(membership.plan_id);

    const { data: ownPlans, error: ownError } = await this.supabase.client
      .from('workout_plan')
      .select('id, active')
      .eq('created_by', userId);

    if (ownError) throw ownError;
    if (!ownPlans || ownPlans.length === 0) return null;

    if (ownPlans.length === 1) {
      return this.dashboardService.getFullPlan(ownPlans[0].id);
    }

    const activePlan = ownPlans.find(p => p.active);
    if (!activePlan) return null;

    return this.dashboardService.getFullPlan(activePlan.id);
  }

  // -------------------------------------------------------------------------
  // Sesija
  // -------------------------------------------------------------------------

  /**
   * Vraća današnji trening. Ako ga nema, pravi ga tako što PREPISUJE vježbe iz
   * plana za taj dan. Od tog trenutka izmjene idu u sesiju, ne u plan — zato se
   * vježba može zamijeniti samo za danas.
   */
  async getOrCreateSession(userId: string, date: string, plan: any): Promise<WorkoutSession | null> {
    const existing = await this.findSession(userId, date);
    if (existing) return existing;

    if (!plan) return null;

    const dayName = this.dayNameFor(date);
    const day = (plan.workout_days ?? []).find((d: any) => d.name === dayName) ?? null;

    const { data: session, error } = await this.supabase.client
      .from('workout_sessions')
      .insert({
        user_id: userId,
        plan_id: plan.id,
        workout_day_id: day?.id ?? null,
        date,
        day_label: dayName,
        day_type_name: day?.day_type?.name ?? null
      })
      .select('id')
      .single();

    if (error) {
      // Dvostruki klik ili drugi uređaj: unique (user_id, date) je uhvatio
      // duplikat — sesija ipak postoji, samo je nije napravio ovaj poziv.
      if (error.code === '23505') {
        const raced = await this.findSession(userId, date);
        if (raced) return raced;
      }
      throw error;
    }

    // Redoslijed uvijek dolazi IZ PLANA.
    //
    // Preređivanje u toku treninga mijenja samo tu sesiju i namjerno se ne
    // prenosi na naredne — tako se može slobodno probati drugi raspored bez
    // posljedica. Ako se novi raspored pokaže kao bolji, mijenja se u samom
    // planu (Planovi -> Izmijeni), i onda vrijedi za sve.
    const dayExercices = [...(day?.day_exercice ?? [])]
      .sort((a: any, b: any) => (a.order_num ?? 0) - (b.order_num ?? 0));

    if (dayExercices.length > 0) {
      const rows = dayExercices.map((dayEx: any, i: number) => ({
        session_id: session.id,
        exercice_id: dayEx.exercice_id,
        order_num: i + 1,
        target_sets: dayEx.target_sets,
        target_reps: dayEx.target_reps
      }));

      const { error: exError } = await this.supabase.client
        .from('session_exercices')
        .insert(rows);

      if (exError) throw exError;
    }

    return this.findSession(userId, date);
  }

  private async findSession(userId: string, date: string): Promise<WorkoutSession | null> {
    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select(`
        id, date, plan_id, day_label, day_type_name, started_at, finished_at, note,
        workout_plan:plan_id ( name ),
        session_exercices (
          id, exercice_id, order_num, target_sets, target_reps, is_extra,
          exercices:exercice_id ( name, picture, is_bodyweight, is_unilateral,
            exercice_muscle ( muscle_group:muscle_group_id ( name ) ) ),
          replaced:replaced_exercice_id ( name )
        )
      `)
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as any;

    return {
      id: row.id,
      date: row.date,
      planId: row.plan_id,
      planName: row.workout_plan?.name ?? null,
      dayLabel: row.day_label,
      dayTypeName: row.day_type_name,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      note: row.note ?? null,
      exercices: ((row.session_exercices ?? []) as any[])
        .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
        .map(se => ({
          id: se.id,
          exerciceId: se.exercice_id,
          name: se.exercices?.name ?? '',
          picture: se.exercices?.picture ?? null,
          orderNum: se.order_num,
          targetSets: se.target_sets,
          targetReps: se.target_reps,
          replacedName: se.replaced?.name ?? null,
          isExtra: se.is_extra,
          isBodyweight: se.exercices?.is_bodyweight ?? false,
          isUnilateral: se.exercices?.is_unilateral ?? false,
          isLegs: ((se.exercices?.exercice_muscle ?? []) as any[])
            .some(m => /leg/i.test(m.muscle_group?.name ?? ''))
        }))
    };
  }

  // -------------------------------------------------------------------------
  // Izmjene sesije — ništa od ovoga ne dira plan
  // -------------------------------------------------------------------------

  /** Zamjena vježbe samo za ovaj trening. Pamti šta je plan predviđao. */
  async replaceExercice(
    sessionExerciceId: string,
    newExerciceId: string,
    originalExerciceId: string
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('session_exercices')
      .update({
        exercice_id: newExerciceId,
        replaced_exercice_id: originalExerciceId
      })
      .eq('id', sessionExerciceId);

    if (error) throw error;
  }

  async addExercice(sessionId: string, exerciceId: string, orderNum: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('session_exercices')
      .insert({
        session_id: sessionId,
        exercice_id: exerciceId,
        order_num: orderNum,
        is_extra: true
      });

    if (error) throw error;
  }

  async removeExercice(sessionExerciceId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('session_exercices')
      .delete()
      .eq('id', sessionExerciceId);

    if (error) throw error;
  }

  /**
   * Vraća redoslijed vježbi u sesiji na onaj iz plana.
   *
   * Sesija je SNIMAK plana napravljen pri prvom otvaranju treninga. Ako se plan
   * poslije toga izmijeni — ili je sesija nastala prije neke ispravke — trening
   * i dalje prikazuje stari raspored, jer se snimak namjerno ne osvježava sam
   * (inače bi izmjena plana usred dana pomjerila ono što se upravo radi).
   *
   * Ovo je izlaz iz te situacije. Vježbe koje su zamijenjene ili ručno dodane
   * nemaju mjesto u planu, pa idu na kraj umjesto da se izgube.
   */
  async resetOrderToPlan(sessionId: string, planDayExercices: any[]): Promise<void> {
    const rank = new Map<string, number>();
    [...planDayExercices]
      .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
      .forEach((de, i) => rank.set(de.exercice_id, i));

    const { data, error } = await this.supabase.client
      .from('session_exercices')
      .select('id, exercice_id, order_num')
      .eq('session_id', sessionId);

    if (error) throw error;

    const sorted = [...(data ?? [])].sort((a: any, b: any) => {
      const ra = rank.get(a.exercice_id);
      const rb = rank.get(b.exercice_id);
      if (ra == null && rb == null) return (a.order_num ?? 0) - (b.order_num ?? 0);
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    });

    await this.setOrder(sorted.map((r: any, i) => ({ id: r.id, orderNum: i + 1 })));
  }

  /** Novi redoslijed vježbi u sesiji. Plan ostaje netaknut. */
  async setOrder(entries: { id: string; orderNum: number }[]): Promise<void> {
    for (const e of entries) {
      const { error } = await this.supabase.client
        .from('session_exercices')
        .update({ order_num: e.orderNum })
        .eq('id', e.id);

      if (error) throw error;
    }
  }

  /** Serije/ponavljanja za OVAJ trening. Plan ostaje netaknut. */
  async updateTargets(
    sessionExerciceId: string,
    targetSets: number | null,
    targetReps: number | null
  ): Promise<void> {
    const { error } = await this.supabase.client
      .from('session_exercices')
      .update({ target_sets: targetSets, target_reps: targetReps })
      .eq('id', sessionExerciceId);

    if (error) throw error;
  }

  /** Upis bilješke uz trening. Prazan tekst briše bilješku. */
  async saveNote(sessionId: string, note: string): Promise<void> {
    const trimmed = note.trim();

    const { error } = await this.supabase.client
      .from('workout_sessions')
      .update({ note: trimmed || null })
      .eq('id', sessionId);

    if (error) throw error;
  }

  async finishSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('workout_sessions')
      .update({ finished_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
  }

  /**
   * Ponovno otvaranje završenog treninga.
   *
   * Namjerno NIJE zaključavanje: trening se zatvori i greškom, a i normalno je
   * sjetiti se serije poslije. Oznaka "gotovo" je izjava namjere, ne brava.
   */
  async reopenSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('workout_sessions')
      .update({ finished_at: null })
      .eq('id', sessionId);

    if (error) throw error;
  }

  /** Da li je korisnik danas označio trening kao gotov. */
  /** Početak i kraj današnje sesije — za dugme „Započni trening" na dashboardu. */
  async getSessionTimes(
    userId: string,
    date: string
  ): Promise<{ startedAt: string | null; finishedAt: string | null }> {
    const { data, error } = await this.supabase.client
      .from('workout_sessions')
      .select('started_at, finished_at')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw error;
    return {
      startedAt: data?.started_at ?? null,
      finishedAt: data?.finished_at ?? null
    };
  }

  // -------------------------------------------------------------------------
  // Upisi
  // -------------------------------------------------------------------------

  async getSessionLogs(sessionId: string): Promise<ExerciceLog[]> {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('set_number', { ascending: true });

    if (error) throw error;
    return data as ExerciceLog[];
  }

  /**
   * Pali/gasi praćenje po stranama (L/D) za vježbu.
   *
   * Na nivou VJEŽBE, ne treninga: ko jednom odluči da lateral raise radi
   * jednoruko, tako ga radi svaki put — a važi i za sve ostale koji je rade,
   * jer je katalog vježbi zajednički.
   */
  async setUnilateral(exerciceId: string, value: boolean): Promise<void> {
    const { error } = await this.supabase.client
      .from('exercices')
      .update({ is_unilateral: value })
      .eq('id', exerciceId);

    if (error) throw error;
  }

  async logSet(entry: {
    userId: string;
    sessionId: string;
    exerciceId: string;
    planId: string | null;
    date: string;
    setNumber: number;
    reps: number;
    weight: number;
    side?: Side;
  }): Promise<ExerciceLog> {
    return this.insertLog(entry);
  }

  private async insertLog(entry: {
    userId: string;
    sessionId: string;
    exerciceId: string;
    planId: string | null;
    date: string;
    setNumber: number;
    reps: number;
    weight: number;
    side?: Side;
  }): Promise<ExerciceLog> {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .insert({
        user_id: entry.userId,
        session_id: entry.sessionId,
        exercice_id: entry.exerciceId,
        plan_id: entry.planId,
        date: entry.date,
        set_number: entry.setNumber,
        reps: entry.reps,
        weight: entry.weight,
        side: entry.side ?? null
      })
      .select()
      .single();

    if (error) throw error;
    return data as ExerciceLog;
  }

  async updateLog(logId: string, reps: number, weight: number): Promise<ExerciceLog> {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .update({ reps, weight })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return data as ExerciceLog;
  }

  // -------------------------------------------------------------------------
  // Dropset — vezan za jednu working seriju, van exercice_logs (vidi
  // 20260727000000_dropset_logs.sql).
  // -------------------------------------------------------------------------

  /** Svi dropsetovi za sesiju, grupisani po working seriji kojoj pripadaju. */
  async getSessionDropsets(sessionId: string): Promise<Map<string, DropsetLog[]>> {
    const { data, error } = await this.supabase.client
      .from('dropset_logs')
      .select('id, exercice_log_id, order_num, reps, weight, exercice_logs!inner(session_id)')
      .eq('exercice_logs.session_id', sessionId)
      .order('order_num', { ascending: true });

    if (error) throw error;

    const result = new Map<string, DropsetLog[]>();
    for (const row of (data ?? []) as any[]) {
      const list = result.get(row.exercice_log_id) ?? [];
      list.push({
        id: row.id,
        exercice_log_id: row.exercice_log_id,
        order_num: row.order_num,
        reps: row.reps,
        weight: row.weight
      });
      result.set(row.exercice_log_id, list);
    }
    return result;
  }

  async logDropset(entry: {
    exerciceLogId: string;
    orderNum: number;
    reps: number;
    weight: number;
  }): Promise<DropsetLog> {
    const { data, error } = await this.supabase.client
      .from('dropset_logs')
      .insert({
        exercice_log_id: entry.exerciceLogId,
        order_num: entry.orderNum,
        reps: entry.reps,
        weight: entry.weight
      })
      .select()
      .single();

    if (error) throw error;
    return data as DropsetLog;
  }

  async updateDropset(id: string, reps: number, weight: number): Promise<DropsetLog> {
    const { data, error } = await this.supabase.client
      .from('dropset_logs')
      .update({ reps, weight })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as DropsetLog;
  }

  async deleteDropset(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('dropset_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /** Brisanje pogrešno upisane serije. Preostale se prenumerišu na frontu. */
  async deleteLog(logId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('exercice_logs')
      .delete()
      .eq('id', logId);

    if (error) throw error;
  }

  async renumberSet(logId: string, setNumber: number): Promise<void> {
    const { error } = await this.supabase.client
      .from('exercice_logs')
      .update({ set_number: setNumber })
      .eq('id', logId);

    if (error) throw error;
  }

  // -------------------------------------------------------------------------
  // Echo — prethodni trening
  // -------------------------------------------------------------------------

  /**
   * Za svaku vježbu vraća rezultate iz POSLJEDNJEG treninga na kojem je rađena,
   * bez obzira na plan i na to koji je dan u sedmici bio.
   *
   * Jedan upit za sve vježbe, pa grupisanje na frontu — inače bi ekran sa deset
   * vježbi napravio deset odlazaka na server prije nego što se išta prikaže.
   */
  async getEcho(
    userId: string,
    exerciceIds: string[],
    beforeDate: string
  ): Promise<Map<string, Echo>> {
    const result = new Map<string, Echo>();
    if (exerciceIds.length === 0) return result;

    // Veza red-iz-baze → duh serije, da se dropsetovi poslije zakače na pravu.
    const byLogId = new Map<string, EchoSet>();

    // Jedan upit PO VJEŽBI, svaki sa granicom — vidi `lastTrainingSets`.
    const perExercice = await Promise.all(
      exerciceIds.map(id => this.lastTrainingSets(userId, id, beforeDate))
    );

    for (const rows of perExercice) {
      if (rows.length === 0) continue;

      // Redovi su poređani od najnovijeg datuma, pa je prvi red taj trening.
      const date = rows[0].date;
      const sets: EchoSet[] = [];

      for (const row of rows) {
        if (row.date !== date) break;   // stigli smo do starijeg treninga

        const set: EchoSet = {
          setNumber: row.set_number,
          reps: row.reps,
          weight: row.weight,
          side: row.side ?? null,
          dropsets: []
        };
        sets.push(set);
        byLogId.set(row.id, set);
      }

      result.set(rows[0].exercice_id, { date, sets });
    }

    await this.attachEchoDropsets(byLogId);
    return result;
  }

  /**
   * Serije POSLJEDNJEG treninga jedne vježbe prije zadatog datuma.
   *
   * ZAŠTO PO VJEŽBI, A NE JEDNIM UPITOM ZA SVE
   *
   * Ranije je ovo bio jedan upit sa `.in(exercice_id, [...])` i BEZ granice: on
   * povuče cijelu istoriju korisnika za svih desetak vježbi tog dana, pa se u
   * pregledaču zadrži samo najskoriji datum i sve ostalo baci.
   *
   * Odbačeno raste zauvijek. Ko vježbu radi jednom sedmično, za godinu ima oko
   * 150 redova po vježbi — dakle oko 1.500 redova povučenih pri svakom otvaranju
   * ekrana treninga, da bi se zadržalo tridesetak. Za dvije godine dvostruko.
   * Upravo to se najgore osjeti tamo gdje se ekran i otvara: u teretani, na
   * slaboj vezi.
   *
   * PostgREST ne zna „po jedan najnoviji iz svake grupe" u jednom upitu — za to
   * bi trebao `DISTINCT ON` kroz RPC, dakle nova migracija koja se mora ručno
   * pustiti i na cloud. Ovo isto ograničava posao, a ne traži ništa novo u bazi:
   * po vježbi se traži najviše `ECHO_ROW_LIMIT` redova, i to tačno onim
   * redoslijedom koji indeks `(user_id, exercice_id, date desc)` već pokriva.
   *
   * Upiti idu uporedo i svaki je sitan, pa je i na lošoj vezi ovo jeftinije od
   * jednog velikog odgovora.
   */
  private async lastTrainingSets(
    userId: string,
    exerciceId: string,
    beforeDate: string
  ): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('id, exercice_id, date, set_number, reps, weight, side')
      .eq('user_id', userId)
      .eq('exercice_id', exerciceId)
      .lt('date', beforeDate)
      .order('date', { ascending: false })
      .order('set_number', { ascending: true })
      .limit(ECHO_ROW_LIMIT);

    if (error) throw error;
    return (data ?? []) as any[];
  }

  /**
   * Dokačinje dropsetove na serije prethodnog treninga.
   *
   * Ide zasebnim upitom, a ne ugniježđenim `select`-om: `getEcho` čita serije za
   * SVE vježbe dana pa odbacuje sve osim najskorijeg datuma po vježbi. Vučenje
   * dropsetova u istom upitu značilo bi povlačiti ih i za sve odbačene treninge.
   */
  private async attachEchoDropsets(byLogId: Map<string, EchoSet>): Promise<void> {
    const ids = [...byLogId.keys()];
    if (ids.length === 0) return;

    const { data, error } = await this.supabase.client
      .from('dropset_logs')
      .select('exercice_log_id, order_num, reps, weight')
      .in('exercice_log_id', ids)
      .order('order_num', { ascending: true });

    if (error) throw error;

    for (const row of (data ?? []) as any[]) {
      byLogId.get(row.exercice_log_id)?.dropsets.push({
        reps: row.reps,
        weight: row.weight
      });
    }
  }

  /**
   * Najveća kilaža za datu vježbu PRIJE zadatog datuma.
   *
   * Namjerno isključuje današnji trening — inače bi prva upisana serija odmah
   * postala "lični rekord" sama sebi, pa bi se rekord prijavljivao na svaku
   * seriju koja je teža od prethodne u istom treningu.
   */
  async getPersonalBests(
    userId: string,
    exerciceIds: string[],
    beforeDate: string
  ): Promise<Map<string, number>> {
    const best = new Map<string, number>();
    if (exerciceIds.length === 0) return best;

    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('exercice_id, weight')
      .eq('user_id', userId)
      .in('exercice_id', exerciceIds)
      .lt('date', beforeDate)
      .order('weight', { ascending: false });

    if (error) throw error;

    for (const row of (data ?? []) as any[]) {
      if (!best.has(row.exercice_id)) best.set(row.exercice_id, row.weight);
    }

    return best;
  }

  // -------------------------------------------------------------------------
  // Zamjena: ponuda vježbi
  // -------------------------------------------------------------------------

  /**
   * Vježbe koje dijele bar jednu mišićnu grupu sa datom — smislene zamjene.
   * Ako vježba nije ni u jednoj grupi, vraća se cijeli katalog, jer je bolje
   * ponuditi previše nego ništa.
   */
  /**
   * Vježbe koje dijele bar jednu mišićnu grupu sa BILO KOJOM iz datog skupa.
   *
   * Služi da se pri dodavanju podrazumijevano ponudi ono što odgovara današnjem
   * treningu, bez potrebe da se zna day_type — izvodi se iz vježbi koje su već
   * u sesiji, pa radi i nakon zamjena i ručnih dodavanja.
   */
  async getRelatedToAll(exerciceIds: string[]): Promise<Set<string>> {
    const result = new Set<string>();
    if (exerciceIds.length === 0) return result;

    const { data: groups, error: gErr } = await this.supabase.client
      .from('exercice_muscle')
      .select('muscle_group_id')
      .in('exercice_id', exerciceIds);

    if (gErr) throw gErr;
    const groupIds = [...new Set((groups ?? []).map(g => g.muscle_group_id))];
    if (groupIds.length === 0) return result;

    const { data: siblings, error: sErr } = await this.supabase.client
      .from('exercice_muscle')
      .select('exercice_id')
      .in('muscle_group_id', groupIds);

    if (sErr) throw sErr;
    (siblings ?? []).forEach(s => result.add(s.exercice_id));
    return result;
  }

  /** Cijeli katalog — za dodavanje vježbe koje nema u planu za taj dan. */
  async getAllExercices(): Promise<{ id: string; name: string; picture: string | null }[]> {
    const { data, error } = await this.supabase.client
      .from('exercices')
      .select('id, name, picture')
      .order('name', { ascending: true });

    if (error) throw error;
    return ((data ?? []) as any[]).map(e => ({ id: e.id, name: e.name ?? '', picture: e.picture }));
  }

  async getAlternatives(exerciceId: string): Promise<{ id: string; name: string; picture: string | null }[]> {
    const { data: groups, error: groupError } = await this.supabase.client
      .from('exercice_muscle')
      .select('muscle_group_id')
      .eq('exercice_id', exerciceId);

    if (groupError) throw groupError;

    const groupIds = (groups ?? []).map(g => g.muscle_group_id);

    let candidateIds: string[] | null = null;

    if (groupIds.length > 0) {
      const { data: siblings, error: sibError } = await this.supabase.client
        .from('exercice_muscle')
        .select('exercice_id')
        .in('muscle_group_id', groupIds);

      if (sibError) throw sibError;
      candidateIds = [...new Set((siblings ?? []).map(s => s.exercice_id))];
    }

    let query = this.supabase.client
      .from('exercices')
      .select('id, name, picture')
      .order('name', { ascending: true });

    if (candidateIds) query = query.in('id', candidateIds);

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as any[])
      .filter(e => e.id !== exerciceId)
      .map(e => ({ id: e.id, name: e.name ?? '', picture: e.picture }));
  }

  // -------------------------------------------------------------------------

  private dayNameFor(date: string): string {
    const DAYS = ['Ponedeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
    const jsDay = new Date(`${date}T12:00:00`).getDay();   // podne: izbjegava
    return DAYS[jsDay === 0 ? 6 : jsDay - 1];              // pomak zbog zone
  }
}
