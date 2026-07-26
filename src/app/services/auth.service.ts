import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { Session, User } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { Profile } from "../models/models"

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  // Sesija se iz localStorage-a čita asinhrono, a komponente je traže sinhrono u
  // ngOnInit. Bez ovoga svaki refresh stranice zatekne BehaviorSubject sa još
  // uvijek null vrijednošću i korisnik dobije "Nisi ulogovan" iako jeste.
  // Guard čeka na ovo obećanje prije nego što pusti rutu, pa je getCurrentUser()
  // u komponentama od tog trenutka pouzdan.
  private readonly sessionReady: Promise<void>;

  constructor(private supabase: SupabaseService) {
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });

    this.sessionReady = this.supabase.client.auth.getSession()
      .then(({ data }) => {
        this.currentUserSubject.next(data.session?.user ?? null);
      })
      .catch(() => {
        // Neispravan ili istekao token u localStorage-u: tretiraj kao odjavu,
        // umjesto da obećanje ostane neispunjeno i zablokira guard zauvijek.
        this.currentUserSubject.next(null);
      });
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Sačekaj da se sesija razriješi, pa tek onda vrati korisnika. Koristi se u
  // guardovima; komponente i dalje mogu koristiti sinhroni getCurrentUser().
  async waitForSession(): Promise<User | null> {
    await this.sessionReady;
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

  async getEmailByUsername(username: string): Promise<string | null> {
    const { data, error } = await this.supabase.client
      .rpc('get_email_by_username', { p_username: username });

    if (error) throw error;
    return data ?? null;
  }

  async signInWithUsername(username: string, password: string) {
    const email = await this.getEmailByUsername(username);
    if (!email) {
      throw new Error('Korisničko ime ne postoji.');
    }
    return this.signIn(email, password);
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