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
      .select('id, key, type, created_at, uploaded_by, size')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as BlogMediaRow[]).map(row => ({
      id: row.id,
      name: row.key,
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
   * Dodaj/skini reakciju — pokušaj upisa, a unique sudar znači da već postoji
   * pa se briše (toggle). Vraća šta se stvarno desilo, da komponenta može
   * uskladiti optimistički prikaz.
   */
  async toggleReaction(mediaId: string, profileId: string, kind: string): Promise<'added' | 'removed'> {
    const { error } = await this.supabase.client
      .from('blog_reactions')
      .insert({ media_id: mediaId, profile_id: profileId, kind });

    if (!error) return 'added';
    if (error.code !== '23505') throw error;

    const { error: delError } = await this.supabase.client
      .from('blog_reactions')
      .delete()
      .eq('media_id', mediaId)
      .eq('profile_id', profileId)
      .eq('kind', kind);

    if (delError) throw delError;
    return 'removed';
  }

  async uploadMedia(file: File, userId: string): Promise<void> {
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
      .insert({ key, type: isVideo ? 'video' : 'image', uploaded_by: userId, size: file.size });

    if (insertError) throw insertError;
  }
}
