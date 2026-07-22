import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { DashboardService } from './dashboard.service';
import { ExerciceLog } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class TrainingService {

  constructor(
    private supabase: SupabaseService,
    private dashboardService: DashboardService
  ) {}

  // Plan za trening ekran: praćen tuđi plan uvek ima prioritet (max jedan zbog unique
  // constraint-a). Ako korisnik ne prati nikog, koristi se jedan od sopstvenih planova -
  // ako ima samo jedan, taj se koristi automatski; ako ih ima više, koristi se onaj
  // označen kao aktivan (a ako nijedan nije aktivan, nema plana za prikaz)
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

  // Već upisani setovi za dati dan, za skup vježbi (koristi se za prikaz progresa i za automatski broj seta)
  async getTodayLogs(
    userId: string,
    planId: string,
    exerciceIds: string[],
    date: string
  ): Promise<ExerciceLog[]> {
    if (exerciceIds.length === 0) return [];

    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('date', date)
      .in('exercice_id', exerciceIds)
      .order('set_number', { ascending: true });

    if (error) throw error;
    return data as ExerciceLog[];
  }

  // Upis jednog seta (broj seta se određuje automatski na osnovu već upisanih setova)
  async logSet(entry: {
    userId: string;
    exerciceId: string;
    planId: string;
    date: string;
    setNumber: number;
    reps: number;
    weight: number;
  }): Promise<ExerciceLog> {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .insert({
        user_id: entry.userId,
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

  // Datum poslednjeg prethodnog treninga za dati skup vježbi (npr. svi "Push" dani u planu,
  // bez obzira na koji dan u nedelji padaju)
  async getPreviousSessionDate(
    userId: string,
    planId: string,
    exerciceIds: string[],
    beforeDate: string
  ): Promise<string | null> {
    if (exerciceIds.length === 0) return null;

    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('date')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .in('exercice_id', exerciceIds)
      .lt('date', beforeDate)
      .order('date', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0]?.date ?? null;
  }

  // Svi upisani setovi za dati datum, sa nazivom vježbe (prethodni dan istog tipa
  // može imati drugačiji spisak vježbi od današnjeg)
  async getSessionResults(
    userId: string,
    planId: string,
    exerciceIds: string[],
    date: string
  ): Promise<{ exercice_id: string; name: string; set_number: number; reps: number; weight: number }[]> {
    if (exerciceIds.length === 0) return [];

    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('exercice_id, set_number, reps, weight, exercices ( name )')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('date', date)
      .in('exercice_id', exerciceIds)
      .order('set_number', { ascending: true });

    if (error) throw error;

    return ((data ?? []) as any[]).map(row => ({
      exercice_id: row.exercice_id,
      name: row.exercices?.name ?? '',
      set_number: row.set_number,
      reps: row.reps,
      weight: row.weight
    }));
  }

  // Izmena već upisanog seta (npr. korisnik je pogrešio reps/kilažu)
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
}
