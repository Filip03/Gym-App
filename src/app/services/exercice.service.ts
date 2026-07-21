import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { Exercice, MuscleGroup } from '../models/models';

export interface MuscleGroupWithExercices {
  id: string;
  name: string;
  exercices: Exercice[];
}

@Injectable({
  providedIn: 'root'
})
export class ExerciceService {

  constructor(private supabase: SupabaseService) {}

  async getMuscleGroups(): Promise<MuscleGroup[]> {
    const { data, error } = await this.supabase.client
      .from('muscle_group')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as MuscleGroup[];
  }

  // Sve vežbe, grupisane po mišićnim grupama (vežba se može pojaviti u više grupa)
  async getExercicesGroupedByMuscleGroup(): Promise<MuscleGroupWithExercices[]> {
    const muscleGroups = await this.getMuscleGroups();

    const { data: exercices, error } = await this.supabase.client
      .from('exercices')
      .select(`
        *,
        exercice_muscle (
          muscle_group_id
        )
      `)
      .order('name', { ascending: true });

    if (error) throw error;

    const groups: MuscleGroupWithExercices[] = muscleGroups.map(mg => ({
      id: mg.id,
      name: mg.name ?? '',
      exercices: []
    }));

    const groupById = new Map(groups.map(g => [g.id, g]));
    const uncategorized: Exercice[] = [];

    for (const ex of exercices ?? []) {
      const muscleGroupIds: string[] = (ex.exercice_muscle ?? []).map((em: any) => em.muscle_group_id);

      if (muscleGroupIds.length === 0) {
        uncategorized.push(ex);
        continue;
      }

      for (const mgId of muscleGroupIds) {
        const group = groupById.get(mgId);
        if (group) group.exercices.push(ex);
      }
    }

    if (uncategorized.length > 0) {
      groups.push({ id: 'uncategorized', name: 'Nekategorisano', exercices: uncategorized });
    }

    return groups;
  }

  async addExercice(entry: {
    name: string;
    description: string;
    picture: string;
    muscleGroupIds: string[];
  }): Promise<Exercice> {
    const { data: newExercice, error } = await this.supabase.client
      .from('exercices')
      .insert({
        name: entry.name,
        description: entry.description || null,
        picture: entry.picture || null
      })
      .select()
      .single();

    if (error) throw error;

    if (entry.muscleGroupIds.length > 0) {
      const rows = entry.muscleGroupIds.map(mgId => ({
        exercice_id: newExercice.id,
        muscle_group_id: mgId
      }));

      const { error: linkError } = await this.supabase.client
        .from('exercice_muscle')
        .insert(rows);

      if (linkError) throw linkError;
    }

    return newExercice as Exercice;
  }
}
