import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { ExerciceService, MuscleGroupWithExercices } from './exercice.service';
import { ProfileService } from './profile.service';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  weight: number;
  reps: number;
  date: string;
  avatarUrl: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {

  constructor(
    private supabase: SupabaseService,
    private exerciceService: ExerciceService,
    private profileService: ProfileService
  ) {}

  async getExerciceGroups(): Promise<MuscleGroupWithExercices[]> {
    return this.exerciceService.getExercicesGroupedByMuscleGroup();
  }

  // Za datu vežbu: poslednji (po datumu) zapis sa set_number = 1 za svakog korisnika,
  // sortirano po kilaži opadajuće (tie-break po broju ponavljanja)
  async getLeaderboard(exerciceId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select(`
        user_id,
        weight,
        reps,
        date,
        profiles:user_id ( username, profile_pic_url )
      `)
      .eq('exercice_id', exerciceId)
      .eq('set_number', 1)
      .order('date', { ascending: false });

    if (error) throw error;

    const latestByUser = new Map<string, LeaderboardEntry>();

    for (const row of (data ?? []) as any[]) {
      if (latestByUser.has(row.user_id)) continue;

      const picturePath = row.profiles?.profile_pic_url;

      latestByUser.set(row.user_id, {
        userId: row.user_id,
        username: row.profiles?.username ?? 'Nepoznat',
        weight: row.weight,
        reps: row.reps,
        date: row.date,
        avatarUrl: picturePath ? this.profileService.getPublicUrl(picturePath) : null
      });
    }

    return Array.from(latestByUser.values()).sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return b.reps - a.reps;
    });
  }
}
