import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase_service';

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

// Ključ u localStorage — po uređaju, ne po korisniku (vidi migraciju 20260728010000_news.sql).
const LAST_SEEN_KEY = 'gymapp.news.lastSeenId';

@Injectable({
  providedIn: 'root'
})
export class NewsService {

  constructor(private supabase: SupabaseService) {}

  async getAllNews(): Promise<NewsItem[]> {
    const { data, error } = await this.supabase.client
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as NewsItem[];
  }

  async getLatestNews(): Promise<NewsItem | null> {
    const { data, error } = await this.supabase.client
      .from('news')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data as NewsItem) ?? null;
  }

  getLastSeenId(): string | null {
    return localStorage.getItem(LAST_SEEN_KEY);
  }

  markSeen(newsId: string) {
    localStorage.setItem(LAST_SEEN_KEY, newsId);
  }

  /** Da li postoji update noviji od onog kojeg je ovaj uređaj već vidio. */
  async hasUnseenNews(): Promise<boolean> {
    const latest = await this.getLatestNews();
    if (!latest) return false;
    return latest.id !== this.getLastSeenId();
  }
}
