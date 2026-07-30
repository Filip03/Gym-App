import { Injectable } from '@angular/core';

const THEME_KEY = 'gymapp.theme';
export type Theme = 'dark' | 'light';

/**
 * Boja trake pregledaca / statusne trake po temi — vrijednost `--void` iz
 * `_tokens.scss`. Drzi se rucno u sinhronu sa tokenima: <meta> ne moze citati
 * CSS varijablu.
 */
const THEME_COLOR: Record<Theme, string> = {
  dark:  '#06080B',
  light: '#EDF1F5',
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

  constructor() {
    this.apply();
  }

  get isLight(): boolean { return this.theme === 'light'; }

  private animTimer: any = null;

  toggle() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, this.theme);

    // Kućno pravilo: nijedna promjena stanja bez pokreta — pa ni tema. Klasa
    // na <html> nakratko upali globalno pretapanje boja (vidi _base.scss),
    // pa se cijela aplikacija PRELIJE iz teme u temu umjesto da pukne.
    const root = document.documentElement;
    root.classList.add('theme-anim');
    clearTimeout(this.animTimer);
    this.animTimer = setTimeout(() => root.classList.remove('theme-anim'), 420);

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
