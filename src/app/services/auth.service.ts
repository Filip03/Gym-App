import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { Session, User } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { Profile } from "../models/models"

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private supabase: SupabaseService) {
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });

    this.supabase.client.auth.getSession().then(({ data }) => {
      this.currentUserSubject.next(data.session?.user ?? null);
    });
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async signUp(email: string, password: string, username: string, weight: number, height: number) {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options:{
        data:{
          username,
          weight,
          height
        }
      }
    });
    if (error) throw error;

    console.log(data.user)

    // pošto profiles.id ima default auth.uid(), profil se ne kreira automatski
    // treba ti trigger u bazi ili ručni insert nakon signup-a

    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
  }

  async getCurrentProfile(): Promise<Profile | null> {
    const user = this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Greška pri dobavljanju profila:', error.message);
      return null;
    }

    return data as Profile;
  }
}