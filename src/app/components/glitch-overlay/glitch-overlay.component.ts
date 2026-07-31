import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { GlitchEvent, GlitchKind, GlitchService } from '../../services/glitch.service';

/**
 * Ekranski „glitch" za trenutke napretka — sci-fi registar u tri faze:
 *
 *   1. TRZAJ SAMOG UI-ja (0–240ms): klasa `glitch-jolt` na <html> — globalni
 *      stil u _base.scss trza CIJELI .shell u tvrdim koracima (translateX +
 *      isječen clip-path kadar). Sadržaj se stvarno pomjeri.
 *   2. NEPROVIDNE TRAKE (0–350ms): krupne pune trake preko ekrana skoče u
 *      steps() koracima kao pomjereni redovi piksela.
 *   3. OLUJA ZNAKOVA + DEKODIRANJE (120ms–kraj): velika mono poruka se
 *      skrembluje JS intervalom pa se slova slijeva nadesno zaključavaju u
 *      konačan tekst („+2 kg" / „NOVI REKORD · 32 kg"); oko nje mali znakovi
 *      blicnu i nestanu. Poruka odstoji pa se raspadne u tvrdim koracima.
 *
 * Živi u app.component.html, `pointer-events: none` — ništa ne blokira.
 * Restart: slojevi se rađaju kroz `*ngFor="let k of burst"` — novi ključ iz
 * servisa ponovo rodi element, pa CSS animacije krenu ispočetka i usred
 * prethodnog prolaza; trzaj shella se restartuje zamjenom klase preko reflow-a.
 *
 * Performanse: samo transform/opacity/clip-path; slojevi postoje u DOM-u samo
 * dok efekat traje (tajmer ih ukloni), pa `will-change` važi samo tada.
 * Svi tajmeri i interval skremblovanja se čiste u ngOnDestroy.
 */

/** Mali znak koji blicne oko poruke. */
interface Spark {
  ch: string;
  x: number;      // % širine
  y: number;      // % visine
  size: number;   // px
  delay: number;  // ms
}

/** Skup znakova oluje — sirovi sci-fi šum: taraba, upitnik, bitovi, grčka. */
const GLYPHS = '#?!01<>/\\_ΔΞ$%&';

/** Ukupno trajanje prolaza — poslije ovoga slojevi izlaze iz DOM-a. */
const TOTAL: Record<GlitchKind, number> = { volt: 950, gold: 1350 };
/** Koliko traje dekodiranje poruke (od prvog do posljednjeg zaključanog slova). */
const DECODE: Record<GlitchKind, number> = { volt: 230, gold: 500 };
/** Broj malih znakova oko poruke. */
const SPARK_COUNT: Record<GlitchKind, number> = { volt: 10, gold: 14 };
/** Kroz koliki se prozor (ms) kaskadno pale mali znakovi. */
const SPARK_SPREAD: Record<GlitchKind, number> = { volt: 420, gold: 720 };

/** Trajanje trzaja cijelog shella — mora pratiti `shell-glitch` u _base.scss. */
const JOLT_MS = 240;
/** Korak skremblovanja: svakih ~45ms novi nasumični znakovi + zaključavanje. */
const TICK_MS = 45;
/** Poruka uleti tek pošto trzaj i trake već divljaju — mora pratiti SCSS delay. */
const MSG_START_MS = 120;
/** Klasa na <html> koja pali trzaj shella (globalni stil u _base.scss). */
const JOLT_CLASS = 'glitch-jolt';

@Component({
  selector: 'app-glitch-overlay',
  templateUrl: './glitch-overlay.component.html',
  styleUrls: ['./glitch-overlay.component.scss']
})
export class GlitchOverlayComponent implements OnInit, OnDestroy {

  kind: GlitchKind = 'volt';
  /** Prazno = nema efekta; [ključ] = jedan prolaz u toku. */
  burst: number[] = [];
  /** Tekst u centru — skrembluje se pa zaključava u konačnu poruku. */
  displayText = '';
  sparks: Spark[] = [];

  private sub: Subscription | null = null;
  private endTimer: any = null;
  private joltTimer: any = null;
  private msgStartTimer: any = null;
  private scrambleTimer: any = null;

  constructor(private glitch: GlitchService) {}

  ngOnInit() {
    this.sub = this.glitch.bursts$.subscribe(e => this.play(e));
  }

  private play(e: GlitchEvent) {
    // Smanjen pokret: trzaj ekrana i oluja znakova su prvo što takva postavka
    // želi ugasiti — ne rađa se ništa, ni klasa na <html> (uz CSS pojas spasa).
    if (typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.kind = e.kind;
    this.burst = [e.key];
    this.sparks = this.makeSparks(e.kind);

    this.jolt();
    this.scramble(e.message, e.kind);

    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => this.burst = [], TOTAL[e.kind]);
  }

  /**
   * Faza 1: trza se SAM UI — klasa na <html>, animacija u _base.scss.
   * Restart usred trzaja: skini klasu, isprovociraj reflow pa je vrati —
   * bez reflow-a pregledač vidi isto stanje i ne odsvira ponovo.
   */
  private jolt() {
    const root = document.documentElement;
    root.classList.remove(JOLT_CLASS);
    void root.offsetWidth;
    root.classList.add(JOLT_CLASS);

    clearTimeout(this.joltTimer);
    this.joltTimer = setTimeout(() => root.classList.remove(JOLT_CLASS), JOLT_MS);
  }

  /**
   * Faza 3: sci-fi dekodiranje. Prvo cijela poruka kao šum (nevidljiva dok je
   * CSS ne uvede u MSG_START_MS), zatim interval na svakom otkucaju zaključa
   * dio slova slijeva i preostala ponovo izmiješa. Broj slova po otkucaju se
   * ravna po dužini poruke, da dekodiranje uvijek stane u DECODE[kind].
   */
  private scramble(message: string, kind: GlitchKind) {
    clearTimeout(this.msgStartTimer);
    clearInterval(this.scrambleTimer);

    this.displayText = this.noise(message, 0);

    this.msgStartTimer = setTimeout(() => {
      const ticks = Math.max(1, Math.round(DECODE[kind] / TICK_MS));
      const perTick = message.length / ticks;
      let tick = 0;

      this.scrambleTimer = setInterval(() => {
        tick++;
        const locked = Math.min(message.length, Math.round(tick * perTick));
        this.displayText = this.noise(message, locked);

        if (locked >= message.length) {
          clearInterval(this.scrambleTimer);
          this.scrambleTimer = null;
        }
      }, TICK_MS);
    }, MSG_START_MS);
  }

  /** Prvih `locked` znakova pravo, ostatak nasumičan šum; razmaci se ne diraju. */
  private noise(message: string, locked: number): string {
    let out = message.slice(0, locked);
    for (let i = locked; i < message.length; i++) {
      out += message[i] === ' '
        ? ' '
        : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    return out;
  }

  /** Mali znakovi na nasumičnim mjestima — svaki sa svojim zakašnjenjem. */
  private makeSparks(kind: GlitchKind): Spark[] {
    return Array.from({ length: SPARK_COUNT[kind] }, () => ({
      ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      x: 4 + Math.random() * 84,
      y: 6 + Math.random() * 80,
      size: 12 + Math.round(Math.random() * 10),
      delay: 40 + Math.round(Math.random() * SPARK_SPREAD[kind])
    }));
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearTimeout(this.endTimer);
    clearTimeout(this.joltTimer);
    clearTimeout(this.msgStartTimer);
    clearInterval(this.scrambleTimer);
    document.documentElement.classList.remove(JOLT_CLASS);
  }
}
