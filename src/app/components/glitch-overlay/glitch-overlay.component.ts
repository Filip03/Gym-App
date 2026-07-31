import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { GlitchEvent, GlitchKind, GlitchService } from '../../services/glitch.service';

/**
 * Ekranski „glitch" sloj — Cyberpunk 2077 registar za trenutke napretka.
 *
 * Živi u app.component.html, preko cijelog ekrana, `pointer-events: none` —
 * čisto svjetlo, ništa se ne može dodirnuti kroz njega niti on išta blokira.
 * Okida ga GlitchService; ovdje se samo vodi životni vijek jednog prolaza.
 *
 * Restart: slojevi se rađaju kroz `*ngFor="let k of burst"` — novi ključ iz
 * servisa ponovo rodi element, pa sve CSS animacije krenu ispočetka i kad
 * prethodni prolaz još traje (trik iz skill-a tecne-animacije).
 *
 * Performanse: element postoji SAMO dok efekat traje — `will-change` u SCSS-u
 * time važi samo za vrijeme prolaza, a po isteku tajmera sve nestaje iz DOM-a.
 * Tajmer se čisti u ngOnDestroy.
 */

/** Trajanje jednog prolaza — mora pokriti najdužu animaciju u SCSS-u. */
const DURATION: Record<GlitchKind, number> = { volt: 600, gold: 950 };

@Component({
  selector: 'app-glitch-overlay',
  templateUrl: './glitch-overlay.component.html',
  styleUrls: ['./glitch-overlay.component.scss']
})
export class GlitchOverlayComponent implements OnInit, OnDestroy {

  kind: GlitchKind = 'volt';
  /** Prazno = nema efekta; [ključ] = jedan prolaz u toku. */
  burst: number[] = [];

  private sub: Subscription | null = null;
  private endTimer: any = null;

  constructor(private glitch: GlitchService) {}

  ngOnInit() {
    this.sub = this.glitch.bursts$.subscribe(e => this.play(e));
  }

  private play(e: GlitchEvent) {
    // Smanjen pokret: bljeskovi preko cijelog ekrana su prvo što takva
    // postavka želi ugasiti — overlay se uopšte ne rađa (uz CSS pojas spasa).
    if (typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.kind = e.kind;
    this.burst = [e.key];

    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => this.burst = [], DURATION[e.kind]);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearTimeout(this.endTimer);
  }
}
