import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Cyberpunk „glitch" preko cijelog ekrana — drugi registar jezika pokreta.
 *
 * Tečni/mastilo jezik pokriva svakodnevne prelaze; glitch je rezervisan za
 * TRENUTKE MOĆI: veća kilaža od prošlog puta ('volt') i novi lični rekord
 * ('gold'). Servis je samo dojavnik — sam efekat crta <app-glitch-overlay>
 * u app.component.html, preko cijelog ekrana.
 *
 * Efekat nosi i PORUKU — brojku koja se u centru ekrana dekodira iz oluje
 * znakova (sci-fi decode): trenutak mora reći ŠTA se desilo („+2 kg",
 * „NOVI REKORD · 32 kg"), ne samo da bljesne.
 *
 * `key` raste sa svakim okidanjem: overlay rađa slojeve kroz
 * `*ngFor="let k of [key]"` trik (vidi skill tecne-animacije), pa novi ključ
 * ponovo rodi element i animacija krene ispočetka — i kad dva okidanja padnu
 * u isti milisekund, zato brojač a ne Date.now().
 */
export type GlitchKind = 'volt' | 'gold';

export interface GlitchEvent {
  kind: GlitchKind;
  /** Tekst koji se dekodira u centru ekrana — npr. „+2 kg". */
  message: string;
  key: number;
}

const FX_KEY = 'gymapp.glitchFx';

@Injectable({ providedIn: 'root' })
export class GlitchService {

  private seq = 0;
  private readonly bursts = new Subject<GlitchEvent>();

  /** Overlay se pretplati jednom i svira svaki najavljeni prolaz. */
  readonly bursts$ = this.bursts.asObservable();

  /**
   * Korisnikov izbor u Profil → Podešavanja. Spektakl preko cijelog ekrana se
   * ne forsira svakome, a slabiji telefon ima pravo da ga ugasi. Gasi SAMO
   * glitch — plamen rekorda, zvuk i vibracije nisu ovim obuhvaćeni.
   */
  enabled = localStorage.getItem(FX_KEY) !== 'off';

  setEnabled(on: boolean): void {
    this.enabled = on;
    localStorage.setItem(FX_KEY, on ? 'on' : 'off');
  }

  /** Jedan prolaz efekta. 'volt' = napredak u kilaži, 'gold' = lični rekord. */
  trigger(kind: GlitchKind, message: string): void {
    if (!this.enabled) return;
    this.bursts.next({ kind, message, key: ++this.seq });
  }
}
