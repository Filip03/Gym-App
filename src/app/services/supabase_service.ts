import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/env';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  public client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        // Sesija preživljava gašenje kartice i aplikacije.
        persistSession: true,
        storage: localStorage,

        // STALAN KLJUČ, ne izveden iz adrese Supabasea.
        //
        // Podrazumijevano supabase-js pravi ključ oblika `sb-<host>-auth-token`.
        // Zbog toga se prijava gubi svaki put kad se adresa promijeni:
        //   - lokalno, pri prelasku sa localhost na 192.168.x.x (telefon),
        //   - u produkciji, jer svaki Vercel preview deploy ima svoj URL.
        // Fiksan ključ to rješava — sesija je vezana za aplikaciju, ne za adresu.
        storageKey: 'gymapp.auth',

        // Osvježavanje tokena u pozadini. Token traje sat vremena; bez ovoga bi
        // korisnik usred treninga ostao bez pristupa.
        autoRefreshToken: true,

        detectSessionInUrl: false
      }
    });
  }
}
