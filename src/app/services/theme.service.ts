import { Injectable, NgZone } from '@angular/core';

const THEME_KEY = 'gymapp.theme';
export type Theme = 'dark' | 'light';

/**
 * Boja trake pregledaca / statusne trake po temi — vrijednost `--void` iz
 * `_tokens.scss`. Drzi se rucno u sinhronu sa tokenima: <meta> ne moze citati
 * CSS varijablu.
 */
const THEME_COLOR: Record<Theme, string> = {
  dark:  '#06080B',
  light: '#ECEBE4',
};

/**
 * Tema aplikacije.
 *
 * Cijeli izgled živi u dizajn tokenima (_tokens.scss), pa je tema samo
 * `data-theme` atribut na <html> — svaka boja se preslika sama, uživo, bez
 * ponovnog učitavanja. Podrazumijevano je tamna (identitet aplikacije);
 * izbor se pamti po uređaju.
 *
 * VAŽNO: atribut se postavlja i u main.ts PRIJE bootstrapa — bez toga bi
 * svijetli korisnik na svakom otvaranju vidio bljesak tamne teme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {

  theme: Theme = (localStorage.getItem(THEME_KEY) === 'light') ? 'light' : 'dark';

  constructor(private zone: NgZone) {
    this.apply();
  }

  get isLight(): boolean { return this.theme === 'light'; }

  private animTimer: any = null;

  /**
   * Promjena teme: NJEŽNO — samo meko pretapanje boja kroz cijelu aplikaciju
   * (klasa `theme-anim`, vidi _base.scss). Sav spektakl živi na samom
   * prekidaču (opruga palca, kap u pilili, ikona koja izroni) — promjena
   * pozadine cijelog ekrana ne treba dramu.
   */
  toggle() {
    const next: Theme = this.theme === 'light' ? 'dark' : 'light';

    // Moderan, fluidan prelaz: View Transitions — pregledač snimi staro i novo
    // stanje ekrana, a CSS (vidi _base.scss) novu temu OTKRIVA mekim talasom
    // odozgo nadolje. Gdje API ne postoji (stariji Safari) ili je pokret
    // isključen, ostaje nježno pretapanje boja.
    const doc = document as any;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (doc.startViewTransition && !reduced) {
      // U zoni! — callback ide van Angulara, pa bez ovoga natpisi i prekidač
      // ostanu na starom stanju dok nešto drugo ne pokrene provjeru promjena.
      doc.startViewTransition(() => this.zone.run(() => this.switchTo(next, true)));
      return;
    }
    this.switchTo(next);
  }

  private switchTo(next: Theme, skipCrossfade = false) {
    this.theme = next;
    localStorage.setItem(THEME_KEY, this.theme);
    if (skipCrossfade) { this.apply(); return; }   // talas režira View Transition

    // Kućno pravilo: nijedna promjena stanja bez pokreta — pa ni tema. Klasa
    // na <html> nakratko upali globalno pretapanje boja (vidi _base.scss),
    // pa se cijela aplikacija PRELIJE iz teme u temu umjesto da pukne.
    const root = document.documentElement;
    root.classList.add('theme-anim');
    clearTimeout(this.animTimer);
    this.animTimer = setTimeout(() => root.classList.remove('theme-anim'), 520);

    this.apply();
  }

  private apply() {
    document.documentElement.setAttribute('data-theme', this.theme);

    // Traka pregledaca (i statusna traka u instaliranoj PWA) ne cita CSS
    // varijable — mora joj se boja upisati u <meta>. Bez ovoga bi okvir oko
    // aplikacije ostao u jednoj temi dok se sadrzaj prelije u drugu.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[this.theme]);
  }
}
