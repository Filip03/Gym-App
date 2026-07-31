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
 * `key` raste sa svakim okidanjem: overlay rađa slojeve kroz
 * `*ngFor="let k of [key]"` trik (vidi skill tecne-animacije), pa novi ključ
 * ponovo rodi element i animacija krene ispočetka — i kad dva okidanja padnu
 * u isti milisekund, zato brojač a ne Date.now().
 */
export type GlitchKind = 'volt' | 'gold';

export interface GlitchEvent {
  kind: GlitchKind;
  key: number;
}

@Injectable({ providedIn: 'root' })
export class GlitchService {

  private seq = 0;
  private readonly bursts = new Subject<GlitchEvent>();

  /** Overlay se pretplati jednom i svira svaki najavljeni prolaz. */
  readonly bursts$ = this.bursts.asObservable();

  /** Jedan prolaz efekta. 'volt' = napredak u kilaži, 'gold' = lični rekord. */
  trigger(kind: GlitchKind): void {
    this.bursts.next({ kind, key: ++this.seq });
  }
}
