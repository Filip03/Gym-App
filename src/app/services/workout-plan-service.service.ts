import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { WorkoutPlan } from '../models/models';

@Injectable({ providedIn: 'root' })
export class WorkoutPlanService {

  constructor(private supabase: SupabaseService) {}

  async getAll(): Promise<WorkoutPlan[]> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as WorkoutPlan[];
  }

  // primer JOIN-a - plan sa danima i vežbama ugnježdeno
  async getPlanWithDays(planId: string) {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .select(`
        *,
        workout_days (
          *,
          day_exercice (
            *,
            exercices (*)
          )
        )
      `)
      .eq('id', planId)
      .single();

    if (error) throw error;
    return data;
  }

  async create(plan: Partial<WorkoutPlan>): Promise<WorkoutPlan> {
    const { data, error } = await this.supabase.client
      .from('workout_plan')
      .insert(plan)
      .select()
      .single();

    if (error) throw error;
    return data as WorkoutPlan;
  }

  async update(id: string, changes: Partial<WorkoutPlan>): Promise<void> {
    const { error } = await this.supabase.client
      .from('workout_plan')
      .update(changes)
      .eq('id', id);

    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.client
      .from('workout_plan')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}