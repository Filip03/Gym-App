import { Directive, HostBinding, HostListener, Injectable, Input } from '@angular/core';

/**
 * Jedno mjesto istine za brzi pregled profila.
 *
 * Do sada je svaki ekran koji pokazuje tuđeg korisnika (leaderboard, blog,
 * dashboard) držao SVOJU kopiju modala i svoj par open/close metoda — tri
 * kopije istog, a svaki novi ekran bi tražio četvrtu. Sada modal postoji
 * JEDNOM, u ljusci aplikacije (app.component), a otvara ga ovaj servis.
 */
@Injectable({ providedIn: 'root' })
export class ProfilePreviewService {
  /** Korisnik čiji je pregled otvoren; null = zatvoreno. */
  userId: string | null = null;

  open(userId: string | null | undefined) {
    if (userId) this.userId = userId;
  }

  close() {
    this.userId = null;
  }
}

/**
 * Zakačka za pregled profila — na BILO ŠTA što predstavlja korisnika.
 *
 *   <div class="avatar" [appProfilePreview]="e.userId">...
 *
 * Element postaje klikabilan i otvara pregled tog korisnika. Time je pregled
 * vezan za tip objekta (avatar/ime), a ne za ekran: novo mjesto sa avatarom
 * dobija pregled jednim atributom, bez metoda u komponenti.
 */
@Directive({
  selector: '[appProfilePreview]',
  standalone: true
})
export class ProfilePreviewDirective {

  @Input('appProfilePreview') userId: string | null | undefined;

  constructor(private preview: ProfilePreviewService) {}

  @HostBinding('class.pp-clickable')
  get clickable(): boolean { return !!this.userId; }

  @HostListener('click', ['$event'])
  onClick(event: Event) {
    if (!this.userId) return;
    // Avatar zna da stoji u redu koji ima svoj klik (lightbox, kartica) —
    // pregled ne smije usput da okine i radnju reda.
    event.stopPropagation();
    this.preview.open(this.userId);
  }
}
