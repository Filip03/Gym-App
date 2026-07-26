import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { Profile } from '../models/models';

const BUCKET_NAME = 'profile-pictures';

/** Jedan odrađen dan u kalendaru treninga. */
export interface TrainingDay {
  date: string;
  /** Broj upisanih serija tog dana — određuje jačinu zelene. */
  sets: number;
}

export interface ProgressPoint {
  date: string;
  weight: number;
  reps: number;
  set_number: number;
}

export interface WeightPoint {
  date: string;
  weight: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {

  constructor(private supabase: SupabaseService) {}

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data as Profile;
  }

  async updateProfile(
    userId: string,
    changes: Partial<Pick<Profile, 'username' | 'height' | 'weight'>>
  ): Promise<Profile> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update(changes)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Profile;
  }

  // Progres kroz vreme za jednu vježbu: svi setovi, sortirano hronološki
  // (filtriranje po set_number se radi na frontu, da ne bi trebalo ponovo da se gađa baza)
  async getProgress(userId: string, exerciceId: string): Promise<ProgressPoint[]> {
    const { data, error } = await this.supabase.client
      .from('exercice_logs')
      .select('date, weight, reps, set_number')
      .eq('user_id', userId)
      .eq('exercice_id', exerciceId)
      .order('date', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ProgressPoint[];
  }

  // Istorija tjelesne težine, sortirano hronološki.
  async getWeightHistory(profileId: string): Promise<WeightPoint[]> {
    const { data, error } = await this.supabase.client
      .from('weight_logs')
      .select('date, weight')
      .eq('profile_id', profileId)
      .order('date', { ascending: true });

    if (error) throw error;
    return (data ?? []) as WeightPoint[];
  }

  // Upisuje/ažurira težinu za dati datum (jedan upis po danu), pa profiles.weight
  // postavlja na vrijednost NAJNOVIJEG upisa — ne nužno onog koji je upravo upisan,
  // jer korisnik može naknadno upisati stariji datum.
  async logWeight(profileId: string, date: string, weight: number): Promise<Profile> {
    const { error: upsertError } = await this.supabase.client
      .from('weight_logs')
      .upsert({ profile_id: profileId, date, weight }, { onConflict: 'profile_id,date' });

    if (upsertError) throw upsertError;

    const { data: latest, error: latestError } = await this.supabase.client
      .from('weight_logs')
      .select('weight')
      .eq('profile_id', profileId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (latestError) throw latestError;

    return this.updateProfile(profileId, { weight: latest.weight });
  }

  async getOtherProfiles(excludeUserId: string): Promise<{ id: string; username: string }[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, username')
      .neq('id', excludeUserId)
      .order('username', { ascending: true });

    if (error) throw error;
    return (data ?? []) as { id: string; username: string }[];
  }

  /**
   * Svi dani u kojima je bilo treninga, za kalendar u profilu.
   *
   * NIJE POTREBNA NOVA TABELA. `workout_sessions` postoji otkad je dodato dugme
   * „Trening gotov". Broj serija se dobija iz `exercice_logs`, i služi samo za
   * jačinu boje.
   *
   * ŠTA SE BROJI KAO TRENING
   *
   * Red u `workout_sessions` NIJE dovoljan. Sesija se pravi već pri otvaranju
   * ekrana treninga (`getOrCreateSession`), pa postoji i za dan kad si samo
   * bacio pogled na aplikaciju. Na rest dayu se to dešava **uvijek** — nema
   * nijedne vježbe da se upiše, a sesija svejedno nastane. Posljedica je bila
   * da neko ko trenira šest dana ispada da trenira sedam.
   *
   * Zato dan ulazi u kalendar samo ako:
   *   - ima bar jednu upisanu seriju, ili
   *   - je sesija izričito završena dugmetom „Trening gotov" (`finished_at`).
   *
   * Isto pravilo važi i za sedmicu ekipe — vidi `LeaderboardService.getTeamWeek`.
   *
   * Povlači se cijela godina odjednom, ali samo kolona `date` — prelazak na
   * prethodni mjesec je zato trenutan, bez novog upita. Za četvoro ljudi i
   * godinu dana to je nekoliko hiljada kratkih redova.
   *
   * Završena sesija bez ijedne serije se i dalje broji (`sets: 0`) — pritisnuo si
   * „Trening gotov", dakle bio si tamo, samo nisi upisivao.
   */
  async getTrainingCalendar(userId: string, sinceIso: string): Promise<TrainingDay[]> {
    const [sessions, logs] = await Promise.all([
      this.supabase.client
        .from('workout_sessions')
        .select('date, finished_at')
        .eq('user_id', userId)
        .not('finished_at', 'is', null)
        .gte('date', sinceIso),
      this.supabase.client
        .from('exercice_logs')
        .select('date')
        .eq('user_id', userId)
        .gte('date', sinceIso)
    ]);

    if (sessions.error) throw sessions.error;
    if (logs.error) throw logs.error;

    const byDate = new Map<string, number>();

    // Samo završene sesije — nezavršena bez ijedne serije znači „otvoren ekran".
    for (const row of (sessions.data ?? []) as any[]) {
      byDate.set(row.date, byDate.get(row.date) ?? 0);
    }

    for (const row of (logs.data ?? []) as any[]) {
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + 1);
    }

    return [...byDate.entries()]
      .map(([date, sets]) => ({ date, sets }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getPublicUrl(path: string): string {
    const { data } = this.supabase.client.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadProfilePicture(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const path = `${userId}/avatar.${fileExt}`;

    // Na iOS Safari-ju upload sa "sirovim" File objektom ume da pošalje prazno telo zahteva
    // ("No content provided") - čitanje u ArrayBuffer pre upload-a to zaobilazi.
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await this.supabase.client.storage
      .from(BUCKET_NAME)
      .upload(path, fileBuffer, { upsert: true, contentType: file.type || 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { error: updateError } = await this.supabase.client
      .from('profiles')
      .update({ profile_pic_url: path })
      .eq('id', userId);

    if (updateError) throw updateError;

    return path;
  }
}
