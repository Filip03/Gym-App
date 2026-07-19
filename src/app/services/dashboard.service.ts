import { Injectable } from '@angular/core';
import { WorkoutPlan, Exercice, DayTypeMuscleGroup, PlanType, DayType } from '../models/models'
import { SupabaseService } from './supabase_service'

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(private supabase: SupabaseService) {}

  // Svi planovi - i tvoji i od drugih korisnika
  async getAllPlans(): Promise<WorkoutPlan[]> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as WorkoutPlan[];
  }

  // Samo planovi koje je trenutni korisnik kreirao
  async getMyPlans(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select(`
        *,
        profiles:created_by ( username, profile_pic_url )
      `)
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getOtherPlans(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select(`
        *,
        profiles:created_by ( username, profile_pic_url )
      `)
      .neq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Svi planovi, sa imenom kreatora ugnježdeno (JOIN sa profiles)
  async getAllPlansWithCreator() {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select(`
        *,
        profiles:created_by ( username, profile_pic_url )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async postPlan(plan: {
    name: string;
    description?: string;
    plan_type_id?: string;
    created_by: string;
  }): Promise<WorkoutPlan> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .insert(plan)
      .select()
      .single();

    if (error) throw error;
    return data as WorkoutPlan;
  }

  // NOVO: izmena plana
  async updatePlan(
    planId: string,
    changes: Partial<Pick<WorkoutPlan, 'name' | 'description' | 'plan_type_id'>>
  ): Promise<WorkoutPlan> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .update(changes)
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;
    return data as WorkoutPlan;
  }

  // NOVO: brisanje plana
  async deletePlan(planId: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('workout_plan')
      .delete()
      .eq('id', planId);

    if (error) throw error;
  }

  async getPlanTypes(): Promise<PlanType[]> {
    const { data, error } = await this.supabase.client
      .from('plan_type')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as PlanType[];
  }

  // Sve vežbe iz kataloga
  async getAllExercices(): Promise<Exercice[]> {
    const { data, error } = await this.supabase.client
      .from('exercices')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Exercice[];
  }

  async getDayTypes(): Promise<DayType[]> {
    const { data, error } = await this.supabase.client
      .from('day_type')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as DayType[];
  }

  // Vraća vežbe filtrirane po day_type preko muscle_group mapiranja
  async getExercicesForDayType(dayTypeId: string): Promise<Exercice[]> {
  // 1. Nađi sve muscle_group_id mapirane na ovaj day_type
  const { data: mappings, error: mapError } = await this.supabase.client
    .from('day_type_muscle_group')
    .select('muscle_group_id')
    .eq('day_type_id', dayTypeId);

  if (mapError) throw mapError;
  if (!mappings || mappings.length === 0) return [];

  const muscleGroupIds = mappings.map(m => m.muscle_group_id);

  // 2. Nađi sve exercice_id povezane sa tim muscle_group_id
  const { data: exerciceMappings, error: emError } = await this.supabase.client
    .from('exercice_muscle')
    .select('exercice_id')
    .in('muscle_group_id', muscleGroupIds);

  if (emError) throw emError;
  if (!exerciceMappings || exerciceMappings.length === 0) return [];

  const exerciceIds = [...new Set(exerciceMappings.map(e => e.exercice_id))];

  // 3. Vrati pune podatke o vežbama
  const { data: exercices, error: exError } = await this.supabase.client
    .from('exercices')
    .select('*')
    .in('id', exerciceIds)
    .order('name', { ascending: true });

  if (exError) throw exError;
  return exercices as Exercice[];
}

// Kreira ceo plan sa danima i vežbama u jednom pozivu
async createFullPlan(
  plan: { name: string; description: string; plan_type_id: string; created_by: string },
  days: {
    dayNumber: number;
    dayName: string;
    dayTypeId: string | null; // null = rest day
    exercices: { exerciceId: string; targetSets: number | null; targetReps: number | null; orderNum: number }[];
  }[]
): Promise<WorkoutPlan> {

  const { data: newPlan, error: planError } = await this.supabase.client
    .from('workout_plan')
    .insert({
      name: plan.name,
      description: plan.description,
      plan_type_id: plan.plan_type_id,
      created_by: plan.created_by
    })
    .select()
    .single();

  if (planError) throw planError;

  for (const day of days) {
    const { data: newDay, error: dayError } = await this.supabase.client
      .from('workout_days')
      .insert({
        plan_id: newPlan.id,
        name: day.dayName,
        day_number: day.dayNumber,
        day_type_id: day.dayTypeId  // <- promenjeno: koristi day_type_id (FK), ne day_type
      })
      .select()
      .single();

    if (dayError) throw dayError;

    if (day.exercices.length > 0) {
      const exerciceRows = day.exercices.map(ex => ({
        workout_day_id: newDay.id,
        exercice_id: ex.exerciceId,
        order_num: ex.orderNum,
        target_sets: ex.targetSets,
        target_reps: ex.targetReps
      }));

      const { error: dayExError } = await this.supabase.client
        .from('day_exercice')
        .insert(exerciceRows);

      if (dayExError) throw dayExError;
    }
  }

  return newPlan as WorkoutPlan;
}
}
