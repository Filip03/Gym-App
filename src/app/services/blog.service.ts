import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';
import { environment } from '../../environments/env';

// Fajlovi žive na Cloudflare R2 (bucket gymapp-blog), ne u Supabase Storage-u —
// R2 ima mnogo veći limit za skladištenje. Otpremanje ide direktno iz browsera
// na R2 preko presigned URL-a kojeg generiše Edge Function (r2-presign);
// Angular nikad ne vidi R2 API ključeve. Baza (tabela blog_media) samo prati
// šta je otpremljeno, jer R2 (za razliku od Supabase Storage-a) nema list().
// Vidi supabase/functions/r2-presign i supabase/migrations/20260726020000_blog_media.sql.

interface BlogMediaRow {
  id: string;
  key: string;
  type: 'image' | 'video';
  created_at: string;
  uploaded_by: string | null;
  size: number | null;
  caption: string | null;
}

/** Jedna reakcija — red iz `blog_reactions`. */
export interface BlogReaction {
  mediaId: string;
  profileId: string;
  kind: string;
}

export interface BlogMediaItem {
  /** `blog_media.id` — ključ za reakcije. */
  id: string;
  name: string;
  /** Opis objave iz kompozera. null = bez teksta. */
  caption: string | null;
  url: string;
  type: 'image' | 'video';
  createdAt: string;
  /**
   * Ko je postavio. Mapirano na `blog_media.uploaded_by` — servis samo prosljeđuje
   * id, komponenta ga prevodi u korisničko ime preko ProfileService.getAllProfiles().
   *
   * Prazno za fajlove ubačene ručno (npr. direktno preko R2 dashboarda), jer
   * tada nema prijavljenog korisnika. Prikazuje se kao „—", ne izmišlja se.
   */
  ownerId: string | null;
  /** Veličina u bajtovima — koristi se za prikaz uštede nakon kompresije. */
  size: number;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {

  constructor(private supabase: SupabaseService) {}

  async listMedia(): Promise<BlogMediaItem[]> {
    const { data, error } = await this.supabase.client
      .from('blog_media')
      .select('id, key, type, created_at, uploaded_by, size, caption')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as BlogMediaRow[]).map(row => ({
      id: row.id,
      name: row.key,
      caption: row.caption ?? null,
      url: this.getPublicUrl(row.key),
      type: row.type,
      createdAt: row.created_at,
      ownerId: row.uploaded_by,
      size: row.size ?? 0
    }));
  }

  getPublicUrl(key: string): string {
    return `${environment.r2PublicUrl}/${key}`;
  }

  // -------------------------------------------------------------------------
  // Reakcije
  // -------------------------------------------------------------------------

  /** Sve reakcije odjednom — grupa je mala, jedan upit umjesto upita po objavi. */
  async listReactions(): Promise<BlogReaction[]> {
    const { data, error } = await this.supabase.client
      .from('blog_reactions')
      .select('media_id, profile_id, kind')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return ((data ?? []) as any[]).map(r => ({
      mediaId: r.media_id,
      profileId: r.profile_id,
      kind: r.kind
    }));
  }

  /**
   * Postavi/skini SVOJU reakciju — jedna po osobi po objavi (unique u bazi):
   * ista vrsta = skidanje, druga vrsta = zamjena, ničega = dodavanje.
   */
  async setReaction(mediaId: string, profileId: string, kind: string): Promise<'added' | 'removed' | 'replaced'> {
    const { data: existing, error } = await this.supabase.client
      .from('blog_reactions')
      .select('id, kind')
      .eq('media_id', mediaId)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw error;

    if (!existing) {
      const { error: insError } = await this.supabase.client
        .from('blog_reactions')
        .insert({ media_id: mediaId, profile_id: profileId, kind });
      if (insError) throw insError;
      return 'added';
    }

    if (existing.kind === kind) {
      const { error: delError } = await this.supabase.client
        .from('blog_reactions')
        .delete()
        .eq('id', existing.id);
      if (delError) throw delError;
      return 'removed';
    }

    const { error: updError } = await this.supabase.client
      .from('blog_reactions')
      .update({ kind })
      .eq('id', existing.id);
    if (updError) throw updError;
    return 'replaced';
  }

  async uploadMedia(file: File, userId: string, caption: string | null = null): Promise<void> {
    const isVideo = file.type.startsWith('video/');
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');

    const { data, error } = await this.supabase.client.functions.invoke<{ uploadUrl: string; key: string }>(
      'r2-presign',
      { body: { ext } }
    );
    if (error) throw error;
    if (!data) throw new Error('Server nije vratio potpisani URL.');

    const { uploadUrl, key } = data;

    // Direktan PUT na R2, mimo Supabase-a — zato i postoji presigned URL.
    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!putResponse.ok) {
      throw new Error(`Otpremanje na R2 nije uspjelo (${putResponse.status}).`);
    }

    const { error: insertError } = await this.supabase.client
      .from('blog_media')
      .insert({ key, type: isVideo ? 'video' : 'image', uploaded_by: userId, size: file.size, caption });

    if (insertError) throw insertError;
  }

  /**
   * Brisanje objave — prvo fajl sa R2 (edge funkcija r2-delete), PA red iz
   * baze (reakcije odu kaskadno preko FK). Redoslijed je bitan: r2-delete
   * provjerava vlasništvo čitajući `uploaded_by` iz blog_media reda, pa taj
   * red mora još postojati u trenutku poziva.
   *
   * Ako R2 čišćenje padne (mreža, funkcija još nije deploy-ovana...), briši
   * red iz baze ionako — objava mora nestati iz feeda odmah; u najgorem
   * slučaju ostaje siroče na R2, što ne smeta korisnicima.
   */
  async deleteMedia(id: string, key: string): Promise<void> {
    const { error: r2Error } = await this.supabase.client.functions.invoke('r2-delete', {
      body: { key }
    });
    if (r2Error) {
      console.error('r2-delete nije uspio — fajl ostaje na R2 kao siroče', r2Error);
    }

    const { error } = await this.supabase.client
      .from('blog_media')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
