import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const NAV_KEY = 'gymapp.footerMode';

/** `classic` = ravan red ikona (zatečeni futer), `dome` = luk sa kliznim tjemenom. */
export type FooterMode = 'classic' | 'dome';

/**
 * Izgled donje navigacije.
 *
 * Isti obrazac kao `ThemeService`: izbor se pamti po uređaju, primjenjuje se
 * ODMAH (bez ponovnog učitavanja) i ostavlja trag na <html> — klasa `nav-dome`
 * — da i globalni CSS može da reaguje. Konkretno, token `--footer-h` je 64 px
 * (klasični futer, piksel u piksel kao ranije) i samo uz tu klasu raste na
 * visinu kupole; modali i lebdeća dugmad se time sami poravnaju.
 *
 * Podrazumijevano je `classic` — kupola je opt-in dok se isprobava.
 */
@Injectable({ providedIn: 'root' })
export class NavModeService {

  private readonly _mode = new BehaviorSubject<FooterMode>(
    localStorage.getItem(NAV_KEY) === 'dome' ? 'dome' : 'classic'
  );

  /** Futer se pretplaćuje na ovo — promjena u profilu stiže bez reload-a. */
  readonly mode$ = this._mode.asObservable();

  constructor() { this.apply(); }

  get mode(): FooterMode { return this._mode.value; }
  get isDome(): boolean { return this._mode.value === 'dome'; }

  toggle() { this.set(this.isDome ? 'classic' : 'dome'); }

  set(mode: FooterMode) {
    if (mode === this._mode.value) return;
    localStorage.setItem(NAV_KEY, mode);
    this._mode.next(mode);
    this.apply();
  }

  private apply() {
    document.documentElement.classList.toggle('nav-dome', this.isDome);
  }
}
