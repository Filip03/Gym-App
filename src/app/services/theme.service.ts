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

  constructor() {
    this.apply();
  }

  get isLight(): boolean { return this.theme === 'light'; }

  private animTimer: any = null;

  /**
   * Promjena teme kao KAP MASTILA: iz tačke dodira (prekidač) krug u boji
   * NOVE teme se razlije preko cijelog ekrana, a ispod njega tema procuri —
   * kućni jezik pokreta primijenjen na najveću moguću promjenu stanja.
   * Bez tačke (ili uz reduced-motion) ostaje samo globalno pretapanje.
   */
  toggle(origin?: { x: number; y: number }) {
    const next: Theme = this.theme === 'light' ? 'dark' : 'light';

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (origin && !reduced) {
      const boja = next === 'light' ? '#ECEBE4' : '#06080B';
      const r = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y)
      );
      const kap = document.createElement('div');
      kap.style.cssText = `position:fixed;left:${origin.x - r}px;top:${origin.y - r}px;`
        + `width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${boja};`
        + `transform:scale(0);pointer-events:none;z-index:9999;`;
      document.body.appendChild(kap);
      const anim = kap.animate(
        [{ transform: 'scale(0)', opacity: 1 },
         { transform: 'scale(1)', opacity: 1, offset: .7 },
         { transform: 'scale(1)', opacity: 0 }],
        { duration: 620, easing: 'cubic-bezier(.3,.7,.3,1)' }
      );
      // Tema se mijenja dok je kap najveća — novi izgled „procuri" ispod nje.
      setTimeout(() => this.switchTo(next), 240);
      anim.onfinish = () => kap.remove();
      // Sigurnosno: i ako onfinish izostane (skriven tab), kap ne smije ostati.
      setTimeout(() => kap.remove(), 900);
      return;
    }

    this.switchTo(next);
  }

  private switchTo(next: Theme) {
    this.theme = next;
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
