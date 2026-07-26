import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { DashboardService } from './dashboard.service';
import { ExerciceLog } from '../models/models';

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
}

export interface WorkoutSession {
  id: string;
  date: string;
  planId: string | null;
  planName: string | null;
  dayLabel: string | null;
  dayTypeName: string | null;
  finishedAt: string | null;
  exercices: SessionExercice[];
}

/** Rezultat jedne serije iz prethodnog treninga — "duh" u polju za unos. */
export interface EchoSet {
  setNumber: number;
  reps: number;
  weight: number;
}

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
    private dashboardService: DashboardService
  ) {}

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
        id, date, plan_id, day_label, day_type_name, finished_at,
        workout_plan:plan_id ( name ),
        session_exercices (
          id, exercice_id, order_num, target_sets, target_reps, is_extra,
          exercices:exercice_id ( name, picture ),
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
      finishedAt: row.finished_at,
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
          isExtra: se.is_extra
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

  async finishSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('workout_sessions')
      .update({ finished_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw error;
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

  async logSet(entry: {
    userId: string;
    sessionId: string;
    exerciceId: string;
    planId: string | null;
    date: string;
    setNumber: number;
    reps: number;
    weight: number;
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
        weight: entry.weight
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

    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('exercice_id, date, set_number, reps, weight')
      .eq('user_id', userId)
      .in('exercice_id', exerciceIds)
      .lt('date', beforeDate)
      .order('date', { ascending: false })
      .order('set_number', { ascending: true });

    if (error) throw error;

    for (const row of (data ?? []) as any[]) {
      const existing = result.get(row.exercice_id);

      // Redovi stižu od najnovijeg datuma; čim naiđe stariji datum za istu
      // vježbu, prethodni trening je već kompletan.
      if (existing && existing.date !== row.date) continue;

      if (!existing) {
        result.set(row.exercice_id, { date: row.date, sets: [] });
      }

      result.get(row.exercice_id)!.sets.push({
        setNumber: row.set_number,
        reps: row.reps,
        weight: row.weight
      });
    }

    return result;
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
