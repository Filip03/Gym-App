import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';

const BUCKET_NAME = 'blog';

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
    const { data, error } = await this.supabase.client.storage
      .from(BUCKET_NAME)
      .list('', { sortBy: { column: 'created_at', order: 'desc' } });

    if (error) throw error;

    return (data ?? [])
      .filter(file => file.id) // preskače placeholder unose za prazne foldere
      .map(file => {
        const mimetype = (file.metadata?.['mimetype'] as string | undefined) ?? '';
        const isVideo = mimetype.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);

        return {
          name: file.name,
          url: this.getPublicUrl(file.name),
          type: isVideo ? 'video' : 'image',
          createdAt: file.created_at ?? ''
        };
      });
  }

  getPublicUrl(path: string): string {
    const { data } = this.supabase.client.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadMedia(file: File): Promise<void> {
    const fileExt = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    // Čitanje u ArrayBuffer da izbegnemo "No content provided" na iOS Safari-ju
    const fileBuffer = await file.arrayBuffer();

    const { error } = await this.supabase.client.storage
      .from(BUCKET_NAME)
      .upload(path, fileBuffer, { contentType: file.type || 'application/octet-stream' });

    if (error) throw error;
  }
}
