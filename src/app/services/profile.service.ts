import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { Profile } from '../models/models';

const BUCKET_NAME = 'profile-pictures';

export interface ProgressPoint {
  date: string;
  weight: number;
  reps: number;
  set_number: number;
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

  // Progres kroz vreme za jednu vežbu: svi setovi, sortirano hronološki
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

  async getOtherProfiles(excludeUserId: string): Promise<{ id: string; username: string }[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, username')
      .neq('id', excludeUserId)
      .order('username', { ascending: true });

    if (error) throw error;
    return (data ?? []) as { id: string; username: string }[];
  }

  getPublicUrl(path: string): string {
    const { data } = this.supabase.client.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadProfilePicture(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const path = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from(BUCKET_NAME)
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { error: updateError } = await this.supabase.client
      .from('profiles')
      .update({ profile_pic_url: path })
      .eq('id', userId);

    if (updateError) throw updateError;

    return path;
  }
}
