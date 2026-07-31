import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { GlitchEvent, GlitchKind, GlitchService } from '../../services/glitch.service';

/**
 * Ekranski „glitch" za trenutke napretka — sci-fi registar u tri faze:
 *
 *   1. TRZAJ SAMOG UI-ja (0–240ms): klasa `glitch-jolt` na <html> — globalni
 *      stil u _base.scss trza CIJELI .shell u tvrdim koracima (translateX +
 *      isječen clip-path kadar). Sadržaj se stvarno pomjeri.
 *   2. ASCII TALAS (0–~kraj): nalet polja monospace znakova koji prohuja preko
 *      ekrana slijeva nadesno — kao da se more sa landinga na tren prelije
 *      preko aplikacije. Gustina je najjača na frontu, iza njega se brzo
 *      prorjeđuje i gasi; između znakova je providno, sadržaj se vidi kroz
 *      talas. Talas JE i oluja znakova: grebeni povremeno trepnu šumom.
 *   3. PORUKA SA DEKODIRANJEM (120ms–kraj): velika mono poruka se skrembluje
 *      JS intervalom pa se slova slijeva nadesno zaključavaju u konačan tekst
 *      („+2 kg" / „NOVI REKORD · 32 kg") — srce efekta.
 *
 * KAKO SE TALAS CRTA (tehnika landinga, vidi landing.component.ts)
 * Polje su DVA <pre> čvora i ništa više: `deep` nosi tamnije znakove, `crest`
 * samo grebene u boji trenutka — svaka ćelija ide u tačno jedan sloj, drugi
 * dobija razmak. Po kadru se upisuju dva `textContent`-a, nijedan DOM čvor se
 * ne pravi ni ne briše; petlja radi VAN Angular zone na ~30 fps, pa nijedan
 * kadar ne pokreće provjeru promjena. Mimo fronta se redovi pune isječcima
 * unaprijed sastavljenog praznog reda, a slabljenje iza fronta ide preko male
 * unaprijed izračunate tabele (bez exp() u unutrašnjoj petlji) — posla ima
 * samo uski pojas oko fronta (~20 kolona), daleko ispod kadra landinga.
 *
 * Živi u app.component.html, `pointer-events: none` — ništa ne blokira.
 * Restart: poruka se rađa kroz `*ngFor="let k of burst"` (novi ključ = nova
 * animacija), talas samo resetuje svoj sat, trzaj shella se restartuje
 * zamjenom klase preko reflow-a. rAF, interval i svi tajmeri se gase i pri
 * isteku i u ngOnDestroy.
 */

// --- Izgled talasa (isti rječnik kao landing) --------------------------------

/** Gustinska ljestvica: od praznine do najgušćeg znaka. Čist ASCII — blokovi
 *  nisu u našem podskupu IBM Plex Mono, pali bi na sistemski font. */
const RAMP = ' .:-=+*#%@';
const RAMP_LAST = RAMP.length - 1;
/** Od ovog stepena naviše znak ide u svijetli sloj (greben talasa). */
const CREST_FROM = 7;

/** Skup znakova šuma — dekodiranje poruke i treptaji u grebenima. */
const GLYPHS = '#?!01<>/\\_ΔΞ$%&';
/** Vjerovatnoća da greben u kadru trepne kao znak šuma — talas JE oluja,
 *  pa je namjerno češće nego na landingu. */
const SPARK_P = 0.06;

/** Koliko „M" mjeri lenjir za širinu znaka. */
const RULER_LEN = 20;
/** ~30 fps — dovoljno za nalet, upola manje posla nego 60. */
const FRAME_MS = 33;

// --- Geometrija fronta -------------------------------------------------------

/** Ukupno trajanje prolaza — poslije ovoga poruka izlazi iz DOM-a. */
const TOTAL: Record<GlitchKind, number> = { volt: 950, gold: 1350 };
/** Koliko frontu treba da uđe, pređe ekran i izađe. */
const WAVE_MS: Record<GlitchKind, number> = { volt: 860, gold: 1200 };
/** Širina naleta ISPRED fronta (kolona) — rijedak sprej koji najavljuje udar. */
const FRONT_W: Record<GlitchKind, number> = { volt: 3, gold: 4 };
/** Širina traga IZA fronta (kolona) — tu se talas prorjeđuje i gasi. */
const TAIL_W: Record<GlitchKind, number> = { volt: 14, gold: 20 };
/** Množilac gustine — zlatni talas je namjerno gušći. */
const DENS: Record<GlitchKind, number> = { volt: 1.0, gold: 1.25 };

/**
 * Slabljenje iza fronta, kvantovano na četvrt kolone — exp() se NE računa po
 * ćeliji nego jednom ovdje: na repu traga gustina padne na ~5%.
 */
function wakeLut(tail: number): Float32Array {
  const lut = new Float32Array(tail * 4 + 2);
  for (let k = 0; k < lut.length; k++) lut[k] = Math.exp(-(k / 4) / (tail / 3));
  return lut;
}
const WAKE: Record<GlitchKind, Float32Array> = {
  volt: wakeLut(TAIL_W.volt),
  gold: wakeLut(TAIL_W.gold)
};

// --- Poruka i trzaj ----------------------------------------------------------

/** Koliko traje dekodiranje poruke (od prvog do posljednjeg zaključanog slova). */
const DECODE: Record<GlitchKind, number> = { volt: 230, gold: 500 };
/** Trajanje trzaja cijelog shella — mora pratiti `shell-glitch` u _base.scss. */
const JOLT_MS = 240;
/** Korak skremblovanja: svakih ~45ms novi nasumični znakovi + zaključavanje. */
const TICK_MS = 45;
/** Poruka uleti tek pošto trzaj i talas već divljaju — mora pratiti SCSS delay. */
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

  // Polje talasa je STALNO u DOM-u (prazan <pre> ne košta ništa) — da bi
  // ViewChild referencije postojale prije prvog kadra, bez čekanja na CD.
  @ViewChild('field') private fieldRef!: ElementRef<HTMLElement>;
  @ViewChild('ruler') private rulerRef!: ElementRef<HTMLElement>;
  @ViewChild('deep')  private deepRef!: ElementRef<HTMLElement>;
  @ViewChild('crest') private crestRef!: ElementRef<HTMLElement>;

  private sub: Subscription | null = null;
  private endTimer: any = null;
  private joltTimer: any = null;
  private msgStartTimer: any = null;
  private scrambleTimer: any = null;

  // Talas
  private raf = 0;
  private waveT0 = 0;
  private lastDraw = -1;
  private waveKind: GlitchKind = 'volt';

  // Mreža — premjeri se pri svakom okidanju (jeftino), tabele se prave samo
  // kad se broj ćelija stvarno promijeni.
  private cols = 0;
  private rows = 0;
  private grain = new Float32Array(0);    // statično zrno po ćeliji [0,1)
  private frontX = new Float32Array(0);   // položaj fronta po redu, po kadru
  private blank = '';                     // gotov prazan red — isječci umjesto petlje

  constructor(private glitch: GlitchService, private zone: NgZone) {}

  ngOnInit() {
    this.sub = this.glitch.bursts$.subscribe(e => this.play(e));
  }

  private play(e: GlitchEvent) {
    // Smanjen pokret: trzaj ekrana i nalet znakova su prvo što takva postavka
    // želi ugasiti — ne dešava se ništa, ni klasa na <html> (uz CSS pojas spasa).
    if (typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.kind = e.kind;
    this.burst = [e.key];

    this.jolt();
    this.startWave(e.kind);
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

  // --- Faza 2: ASCII talas ---------------------------------------------------

  private startWave(kind: GlitchKind) {
    this.stopWave();
    this.measure();
    if (!this.cols || !this.rows) return;

    this.waveKind = kind;
    this.waveT0 = performance.now();
    this.lastDraw = -1;

    // Van zone: nijedan kadar ne smije pokrenuti provjeru promjena.
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame(this.waveTick);
    });
  }

  private waveTick = () => {
    const t = performance.now() - this.waveT0;
    if (t >= WAVE_MS[this.waveKind]) { this.stopWave(); return; }

    this.raf = requestAnimationFrame(this.waveTick);
    if (t - this.lastDraw < FRAME_MS) return;   // preskok do ~30 fps
    this.lastDraw = t;
    this.drawWave(t);
  };

  /** Gasi kadar i briše polje — talas ne smije ostati zamrznut na ekranu. */
  private stopWave() {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (this.deepRef)  this.deepRef.nativeElement.textContent = '';
    if (this.crestRef) this.crestRef.nativeElement.textContent = '';
  }

  /**
   * Mreža po receptu landinga: veličina znaka iz širine ekrana, stvarna širina
   * IZMJERENA lenjirom (konstanti 0.6em se ne vjeruje), tabele nezavisne od
   * vremena unaprijed. Zrno po ćeliji je statično — treptaj po kadru pravi
   * pomak indeksa (seed), ne novo Math.random() po ćeliji.
   */
  private measure() {
    const field = this.fieldRef?.nativeElement;
    if (!field) { this.cols = 0; this.rows = 0; return; }

    const w = field.clientWidth;
    const h = field.clientHeight;
    if (!w || !h) { this.cols = 0; this.rows = 0; return; }

    const targetAdv = Math.max(10, Math.min(20, w / 34));
    const font = Math.max(14, Math.round(targetAdv / 0.6));
    const lineH = Math.round(font * 1.15);
    field.style.fontSize = font + 'px';
    field.style.lineHeight = lineH + 'px';

    const adv = this.rulerRef.nativeElement.getBoundingClientRect().width / RULER_LEN
      || font * 0.6;

    const cols = Math.min(140, Math.ceil(w / adv) + 1);
    const rows = Math.min(120, Math.ceil(h / lineH) + 1);
    if (cols === this.cols && rows === this.rows) return;

    this.cols = cols;
    this.rows = rows;
    this.blank = ' '.repeat(cols);
    this.frontX = new Float32Array(rows);
    this.grain = new Float32Array(cols * rows);
    for (let i = 0; i < this.grain.length; i++) this.grain[i] = Math.random();
  }

  /**
   * Jedan kadar naleta.
   *
   * Front ide konstantnom brzinom slijeva nadesno, po redu krivuda kroz dva
   * sinusa (računata PO REDU, ne po ćeliji). Gustina ćelije: uski sprej ispred
   * fronta linearno gasne, iza fronta eksponencijalno kroz WAKE tabelu; ćelija
   * se pali kad gustina nadmaši njeno zrno — pa je prorjeđivanje iza fronta
   * doslovno vjerovatnoća, bez ikakvog dodatnog računa. Redovi mimo fronta se
   * pune isječcima gotovog praznog reda.
   */
  private drawWave(t: number) {
    const cols = this.cols, rows = this.rows;
    if (!cols || !rows) return;

    const kind = this.waveKind;
    const frontW = FRONT_W[kind];
    const tailW = TAIL_W[kind];
    const dens = DENS[kind];
    const wake = WAKE[kind];

    // Front ulazi lijevo van ekrana i izlazi desno van — prelaz preko cijelog
    // polja, uključujući rep koji se još gasi dok front već izlazi.
    const p = t / WAVE_MS[kind];
    const fx = -tailW + p * (cols + tailW + frontW + 6);

    // Na posljednjih ~18% prolaza cijeli talas izblijedi — „signal se uhvati".
    const fade = p > 0.82 ? (1 - p) / 0.18 : 1;
    const amp = dens * fade;

    // Krivudanje fronta po redu — bez njega je front lenjir, ne voda.
    const frontX = this.frontX;
    const ty = t * 0.001;
    for (let y = 0; y < rows; y++) {
      frontX[y] = fx + 2.4 * Math.sin(y * 0.33 + ty * 5.2)
                     + 1.3 * Math.sin(y * 0.11 - ty * 3.1);
    }

    const grain = this.grain, blank = this.blank;
    const total = grain.length;
    // Pomak zrna po kadru: isto polje treperi bez novog random-a po ćeliji.
    const seed = (Math.random() * total) | 0;

    let deep = '', crest = '';
    let i = 0;
    for (let y = 0; y < rows; y++) {
      const f = frontX[y];
      const x0 = Math.max(0, Math.ceil(f - tailW));
      const x1 = Math.min(cols - 1, Math.floor(f + frontW));

      if (x1 < x0) {   // red van pojasa fronta — čist razmak, bez petlje
        deep += blank; crest += blank;
        deep += '\n'; crest += '\n';
        i += cols;
        continue;
      }

      if (x0 > 0) { deep += blank.slice(0, x0); crest += blank.slice(0, x0); }
      i += x0;

      for (let x = x0; x <= x1; x++, i++) {
        const d = x - f;
        // Gustina: 1 na samom frontu; ispred linearni sprej, iza WAKE tabela.
        const v = amp * (d > 0 ? 1 - d / frontW : wake[(-d * 4) | 0]);

        let g = i + seed;
        if (g >= total) g -= total;
        const cv = v - grain[g];

        if (cv <= 0) { deep += ' '; crest += ' '; continue; }

        const idx = 1 + ((cv * (RAMP_LAST - 1) + 0.5) | 0);
        if (idx >= CREST_FROM) {
          crest += Math.random() < SPARK_P
            ? GLYPHS[(Math.random() * GLYPHS.length) | 0]
            : RAMP[idx > RAMP_LAST ? RAMP_LAST : idx];
          deep += ' ';
        } else {
          deep += RAMP[idx];
          crest += ' ';
        }
      }

      if (x1 < cols - 1) {
        deep += blank.slice(0, cols - 1 - x1);
        crest += blank.slice(0, cols - 1 - x1);
        i += cols - 1 - x1;
      }
      deep += '\n'; crest += '\n';
    }

    this.deepRef.nativeElement.textContent = deep;
    this.crestRef.nativeElement.textContent = crest;
  }

  // --- Faza 3: poruka --------------------------------------------------------

  /**
   * Sci-fi dekodiranje. Prvo cijela poruka kao šum (nevidljiva dok je CSS ne
   * uvede u MSG_START_MS), zatim interval na svakom otkucaju zaključa dio
   * slova slijeva i preostala ponovo izmiješa. Broj slova po otkucaju se ravna
   * po dužini poruke, da dekodiranje uvijek stane u DECODE[kind].
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

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.stopWave();
    clearTimeout(this.endTimer);
    clearTimeout(this.joltTimer);
    clearTimeout(this.msgStartTimer);
    clearInterval(this.scrambleTimer);
    document.documentElement.classList.remove(JOLT_CLASS);
  }
}
