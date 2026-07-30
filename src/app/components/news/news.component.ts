import { Component, OnInit } from '@angular/core';
import { NewsService, NewsItem } from '../../services/news.service';

@Component({
  selector: 'app-news',
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss']
})
export class NewsComponent implements OnInit {
  loading = true;
  errorMessage = '';
  items: NewsItem[] = [];

  constructor(private newsService: NewsService) {}

  async ngOnInit() {
    try {
      this.items = await this.newsService.getAllNews();
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju novosti.';
    } finally {
      this.loading = false;
    }
  }
}
