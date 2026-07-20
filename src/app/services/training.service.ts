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

  // Plan za trening ekran: prioritet ima sopstveni plan (kreator),
  // ako korisnik nema svoj plan, koristi se plan kojem se pridružio
  async getPlanForUser(userId: string) {
    const { data: ownPlan, error: ownError } = await this.supabase.client
      .from('workout_plan')
      .select('id')
      .eq('created_by', userId)
      .maybeSingle();

    if (ownError) throw ownError;
    if (ownPlan) return this.dashboardService.getFullPlan(ownPlan.id);

    const { data: membership, error: memberError } = await this.supabase.client
      .from('plan_members')
      .select('plan_id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!membership) return null;

    return this.dashboardService.getFullPlan(membership.plan_id);
  }

  // Već upisani setovi za dati dan, za skup vežbi (koristi se za prikaz progresa i za automatski broj seta)
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
