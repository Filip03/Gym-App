import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { environment } from '../../environments/env';

/**
 * Društvena obavještenja — push DRUGOM korisniku preko Filipovog Spring Boot
 * backenda (isti šasija kao tajmer pauze, ADR-0002): frontend pozove
 * endpoint sa svojim JWT-om, backend nađe device_tokens CILJNOG korisnika i
 * pošalje FCM odmah (bez zakazivanja).
 *
 * Prvi potrošači: reakcija na objavu i novi pratilac plana (Markov izbor;
 * „oboren rekord" svjesno preskočen — previše buke).
 *
 * TIHO NA GREŠCI, kao i tajmer: dok Filip ne doda endpoint, poziv pada u
 * console.warn i niko ništa ne primijeti — funkcija proradi sama od sebe
 * kad backend stigne.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {

  constructor(private supabase: SupabaseService) {}

  async sendToUser(targetUserId: string, title: string, body: string, url: string): Promise<void> {
    try {
      const { data } = await this.supabase.client.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) return;

      await fetch(`${environment.apiBaseUrl}/api/notifications/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ targetUserId, title, body, url })
      });
    } catch (err) {
      console.warn('Slanje društvenog obavještenja nije uspjelo:', err);
    }
  }
}
