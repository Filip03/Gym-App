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
  key: string;
  type: 'image' | 'video';
  created_at: string;
}

export interface BlogMediaItem {
  name: string;
  url: string;
  type: 'image' | 'video';
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {

  constructor(private supabase: SupabaseService) {}

  async listMedia(): Promise<BlogMediaItem[]> {
    const { data, error } = await this.supabase.client
      .from('blog_media')
      .select('key, type, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as BlogMediaRow[]).map(row => ({
      name: row.key,
      url: this.getPublicUrl(row.key),
      type: row.type,
      createdAt: row.created_at
    }));
  }

  getPublicUrl(key: string): string {
    return `${environment.r2PublicUrl}/${key}`;
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
      .insert({ key, type: isVideo ? 'video' : 'image', uploaded_by: userId });

    if (insertError) throw insertError;
  }
}
