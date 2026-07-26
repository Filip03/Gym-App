import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AudioService } from '../../services/audio.service';

interface RouteMeta {
  title: string;
  /** Gdje vodi strelica nazad. null = ekran je korijen, strelice nema. */
  back: string | null;
}

// Naslov i odredište strelice po ruti. Držano na jednom mjestu umjesto da
// svaki ekran sam crta svoje zaglavlje — tako se ne može desiti da negdje
// fali dugme nazad, što je i bio problem na /training (jedini izlaz je bio
// dugme na dnu, ispod svih vježbi).
const ROUTES: Record<string, RouteMeta> = {
  '/dashboard':   { title: 'Planovi',     back: null },
  '/training':    { title: 'Trening',     back: '/dashboard' },
  '/exercices':   { title: 'Vježbe',      back: null },
  '/leaderboard': { title: 'Ekipa',       back: null },
  '/profiles':    { title: 'Profil',      back: null },
  '/blog':        { title: 'Blog',        back: null }
};

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnDestroy {
  title = '';
  backTo: string | null = null;

  private sub: Subscription;

  constructor(private router: Router, public audio: AudioService) {
    this.apply(this.router.url);

    this.sub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.apply(this.router.url));
  }

  private apply(url: string) {
    const path = url.split(/[?#]/)[0];
    const meta = ROUTES[path];

    this.title = meta?.title ?? '';
    this.backTo = meta?.back ?? null;
  }

  goBack() {
    if (this.backTo) this.router.navigate([this.backTo]);
  }

  toggleSound() {
    this.audio.toggleMute();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
