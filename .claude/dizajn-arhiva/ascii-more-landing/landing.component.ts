import {
  AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { Router } from '@angular/router'
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

/**
 * SPLASH — ASCII TALAS-POLJE
 *
 * Cijeli ekran je jedno more od monospace znakova koje se stvarno talasa, a iz
 * njega izranja identitet aplikacije. Redoslijed kadra:
 *
 *   1. more se budi (amplituda 0.16 → 1 kroz prvih 900 ms),
 *   2. UDAR se skuplja ka centru (implozija) i stiže tačno kad logo izroni,
 *   3. logo izranja „tečnim" jezikom (squash & stretch + ink-bloom kap), a oko
 *      njega se voda SMIRI — talas se prigušuje u elipsi ispod identiteta, pa
 *      izgleda kao da ga more izbaci i razmakne se oko njega,
 *   4. novi udar odlazi napolje kroz polje,
 *   5. natpis se DEKODIRA iz šuma (isti sci-fi registar kao glitch-overlay),
 *   6. mjerač „ZAGRIJAVANJE" se puni do samog preusmjerenja,
 *   7. na izlazu more nabuja (posljednji udar) i sve se pretopi u ništa.
 *
 * KAKO SE CRTA (i zašto je jeftino)
 * Polje su DVA <pre> čvora jedan preko drugog i ništa više: donji nosi mirne
 * znakove (dolje i bokovi talasa), gornji samo GREBENE u volt boji. Svaka ćelija
 * ide u tačno jedan sloj, drugi na tom mjestu dobija razmak — pa se znakovi
 * nikad ne preklapaju, a sjaj (text-shadow) pada samo na ~15% ćelija koje ga
 * stvarno traže. Po kadru se upisuju dva `textContent`-a; nijedan DOM čvor se
 * ne pravi ni ne briše. Nema canvasa, nema hiljadu <span>-ova.
 *
 * Visina talasa je zbir tri sinusa, ali se sinusi računaju PO REDU i PO KOLONI,
 * ne po ćeliji: dijagonalni član se razlaže preko sin(a+b) = sin a·cos b +
 * cos a·sin b, pa u unutrašnjoj petlji ostanu samo sabiranja i množenja. Za
 * mrežu 35×38 (telefon) to je ~1300 ćelija × desetak operacija na 30 fps —
 * ispod milisekunde po kadru, telefon se ne grije.
 *
 * Krug udara i „mirna voda" oko loga traže rastojanje ćelije od centra; ono se
 * računa JEDNOM pri mjerenju (Float32Array), ne po kadru.
 *
 * Petlja radi VAN Angular zone i piše direktno u `textContent` — nijedan kadar
 * ne pokreće provjeru promjena. U zonu se vraća samo preusmjerenje.
 */

// --- Izgled polja ----------------------------------------------------------

/** Gustinska ljestvica: od praznine do najgušćeg znaka. Čist ASCII namjerno —
 *  blokovi (░▒▓█) nisu u našem podskupu IBM Plex Mono fonta, pa bi pali na
 *  sistemski font sa drugom širinom znaka i mreža bi se raspala. */
const RAMP = ' .:-=+*#%@';
const RAMP_LAST = RAMP.length - 1;
/** Od ovog stepena naviše znak ide u svijetli sloj (greben talasa). */
const CREST_FROM = 7;

/** Šum za dekodiranje natpisa i za treptaj u grebenima — sci-fi registar. */
const NOISE = '#?!01<>/\\_$%&*+=~';
/** Vjerovatnoća da greben u jednom kadru trepne kao znak šuma. */
const SPARK_P = 0.012;

/** Koliko „M" mjeri lenjir za širinu znaka. */
const RULER_LEN = 20;

// --- Talas -----------------------------------------------------------------
// Frekvencije su u ĆELIJAMA, a ćelija je oko dva puta viša nego šira, pa je
// vertikalna frekvencija veća — u pikselima talas onda izgleda okruglo.
const KX = 0.26, SX = 1.55;     // uzdužni talas
const KY = 0.47, SY = -1.05;    // poprečni talas
const KDX = 0.19, KDY = 0.34, SD = 0.85;   // dijagonalni talas
const WSUM = 1 / 1.4;           // 0.55 + 0.45 + 0.40 → nazad u [-1, 1]

/** Udar kroz polje. `dir: -1` se skuplja ka centru, `1` odlazi napolje. */
interface Pulse { at: number; dir: 1 | -1; amp: number; }

/** Koliko traje jedan udar i koliko je „debeo" njegov prsten. */
const PULSE_MS = 700;
const PULSE_W = 0.17;
/** Domet u jedinicama gdje je 1 = polovina kraće strane ekrana. */
const PULSE_REACH = 1.5;

/** Mirna voda oko identiteta: poluprečnik i spljoštenost po visini (< 1 znači
 *  elipsa viša nego šira — ispod loga stoje još natpis i mjerač). */
const POOL_R = 0.55;
const POOL_Y = 0.40;

// --- Vremenska osa (ms od ngOnInit) ----------------------------------------
const T_MARK   = 560;    // logo počinje da izranja (mora pratiti delay u SCSS)
const T_TAG    = 980;    // natpis se diže i kreće dekodiranje (isti delay u SCSS)
const T_DECODE = 560;    // koliko dekodiranje traje
const T_METER  = 1560;   // mjerač kreće
const T_EXIT   = 2880;   // gašenje: nabujali talas + pretapanje
const T_LEAVE  = 3380;   // preusmjerenje

const PULSES: Pulse[] = [
  { at: 0,       dir: -1, amp: 0.95 },   // implozija — stiže u centar na 700 ms
  { at: 640,     dir:  1, amp: 1.10 },   // logo je izronio, val odlazi napolje
  { at: T_EXIT,  dir:  1, amp: 1.50 },   // posljednji udar pri gašenju
];

/** ~30 fps: dovoljno za talas, upola manje posla nego 60. */
const FRAME_MS = 33;

// --- Natpis i mjerač -------------------------------------------------------
const LEAD = 'JEBA';
const TAIL = ' NE SMIJE DA STANE';
const TAGLINE = LEAD + TAIL;

const METER_CELLS = 14;
const meterText = (n: number) => '[' + '#'.repeat(n) + '-'.repeat(METER_CELLS - n) + ']';

/** Glatko 0→1 (smoothstep) — bez trzaja na krajevima. */
function smooth01(x: number): number {
  const u = x < 0 ? 0 : x > 1 ? 1 : x;
  return u * u * (3 - 2 * u);
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {

  fadeOut = false;
  readonly tagline = 'Jeba ne smije da stane';

  @ViewChild('field') private fieldRef!: ElementRef<HTMLElement>;
  @ViewChild('ruler') private rulerRef!: ElementRef<HTMLElement>;
  @ViewChild('deep')  private deepRef!: ElementRef<HTMLElement>;
  @ViewChild('crest') private crestRef!: ElementRef<HTMLElement>;
  @ViewChild('lead')  private leadRef!: ElementRef<HTMLElement>;
  @ViewChild('tail')  private tailRef!: ElementRef<HTMLElement>;
  @ViewChild('meter') private meterRef!: ElementRef<HTMLElement>;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private raf = 0;
  private t0 = 0;
  private lastDraw = 0;
  private leaving = false;
  private reduced = false;

  // Mreža
  private cols = 0;
  private rows = 0;

  // Po ćeliji, računa se samo pri mjerenju
  private dist = new Float32Array(0);   // rastojanje od centra (1 = pola ekrana)
  private pool = new Float32Array(0);   // koliko je tu voda smirena zbog loga
  private sinP = new Float32Array(0);   // dijagonalni član, dio koji zavisi od x
  private cosP = new Float32Array(0);

  // Radne trake, jedan upis po kadru
  private ax = new Float32Array(0);
  private by = new Float32Array(0);
  private sinQ = new Float32Array(0);
  private cosQ = new Float32Array(0);

  private tagDone = false;
  private meterShown = -1;

  constructor(private router: Router, private authService: AuthService,
              public theme: ThemeService, private zone: NgZone){}

  ngOnInit(){
    this.reduced = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.t0 = performance.now();

    this.timers.push(setTimeout(() => {
      this.fadeOut = true;
    }, T_EXIT));

    this.timers.push(setTimeout(() => this.leave(), T_LEAVE));
  }

  ngAfterViewInit(){
    // Natpis i mjerač dobijaju sadržaj ODMAH (natpis kao čist šum, nevidljiv do
    // svog ulaza) — da red ne bude visine nula pa da cijeli identitet poskoči
    // kad se tekst pojavi.
    this.paintTag(this.noise(0));
    this.meterRef.nativeElement.textContent = meterText(0);

    // Smanjen pokret: JEDAN statičan kadar mora — polje se ne talasa, natpis je
    // odmah dekodiran, mjerač pun. Tok (i preusmjerenje) ostaju isti.
    if (this.reduced) {
      this.layout();
      this.draw(1400);
      this.paintTag(TAGLINE);
      this.meterRef.nativeElement.textContent = meterText(METER_CELLS);
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.layout();
      this.draw(0);   // prvi kadar odmah, da prvo bojenje ne uhvati prazno polje
      window.addEventListener('resize', this.onResize);

      // Font se učitava lokalno, ali ako stigne poslije prvog mjerenja širina
      // znaka se promijeni — mreža se prebroji, inače bi redovi visili.
      const fonts: FontFaceSet | undefined = (document as any).fonts;
      fonts?.ready?.then(() => { if (!this.leaving) this.layout(); });

      this.raf = requestAnimationFrame(this.tick);
    });
  }

  /** Dodir bilo gdje preskače splash. Pretapanje krene odmah kao potvrda. */
  skip(){
    if (this.leaving) return;
    this.fadeOut = true;
    this.leave();
  }

  @HostListener('document:keydown')
  onKey(){ this.skip(); }

  // --- Odlazak sa ekrana ----------------------------------------------------

  private leave(){
    if (this.leaving) return;
    this.leaving = true;
    this.stop();

    void (async () => {
      // Prijavljen korisnik ide pravo na dashboard. Ranije je uvijek išao na
      // /login, pa ga je guard odatle vraćao — dva preusmjeravanja umjesto jednog.
      const user = await this.authService.waitForSession();
      this.router.navigate([user ? '/dashboard' : '/login']);
    })();
  }

  /** Gasi SVE što tiktače: kadar, tajmere i osluškivač veličine ekrana. */
  private stop(){
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    if (this.resizeTimer) { clearTimeout(this.resizeTimer); this.resizeTimer = null; }
    this.timers.forEach(clearTimeout);
    this.timers = [];
    window.removeEventListener('resize', this.onResize);
  }

  ngOnDestroy(){
    // Bez ovoga tajmer nastavi da radi i nakon što korisnik ode sa landinga,
    // pa ga sekundu kasnije izbaci nazad usred nečega drugog.
    this.stop();
  }

  // --- Mreža ----------------------------------------------------------------

  private onResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.layout(), 150);
  };

  /**
   * Bira veličinu znaka iz širine ekrana, IZMJERI stvarnu širinu znaka lenjirom
   * (ne vjeruje se konstanti 0.6em — ako font padne na sistemski, mreža bi bila
   * kriva) i priprema sve tabele koje ne zavise od vremena.
   */
  private layout(){
    const field = this.fieldRef.nativeElement;
    const w = field.clientWidth;
    const h = field.clientHeight;
    if (!w || !h) return;

    // Krupno je ljepše od sitnog: ~34 kolone na telefonu, znak nikad ispod 10px
    // ni preko 20px, pa polje na svim ekranima ima sličan broj ćelija.
    const targetAdv = Math.max(10, Math.min(20, w / 34));
    const font = Math.max(14, Math.round(targetAdv / 0.6));
    const lineH = Math.round(font * 1.15);
    field.style.fontSize = font + 'px';
    field.style.lineHeight = lineH + 'px';

    const adv = this.rulerRef.nativeElement.getBoundingClientRect().width / RULER_LEN
      || font * 0.6;

    const cols = Math.min(140, Math.ceil(w / adv) + 1);
    const rows = Math.min(120, Math.ceil(h / lineH) + 1);
    this.cols = cols;
    this.rows = rows;

    this.ax = new Float32Array(cols);
    this.by = new Float32Array(rows);
    this.sinQ = new Float32Array(rows);
    this.cosQ = new Float32Array(rows);

    // Dijagonalni član: dio koji zavisi od kolone je stalan, pa se težina 0.40
    // odmah umnoži u njega.
    this.sinP = new Float32Array(cols);
    this.cosP = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      const p = x * KDX;
      this.sinP[x] = 0.40 * Math.sin(p);
      this.cosP[x] = 0.40 * Math.cos(p);
    }

    // Rastojanje od centra u pikselima, normalizovano na polovinu kraće strane —
    // krug udara je onda stvarno krug, a ne elipsa razvučena po ćelijama.
    const half = Math.min(w, h) / 2 || 1;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    this.dist = new Float32Array(cols * rows);
    this.pool = new Float32Array(cols * rows);
    let i = 0;
    for (let y = 0; y < rows; y++) {
      const dy = (y - cy) * lineH / half;
      for (let x = 0; x < cols; x++, i++) {
        const dx = (x - cx) * adv / half;
        this.dist[i] = Math.sqrt(dx * dx + dy * dy);
        this.pool[i] = Math.exp(-(dx * dx + dy * dy * POOL_Y) / (POOL_R * POOL_R));
      }
    }

    if (this.reduced) this.draw(1400);
  }

  // --- Kadar ----------------------------------------------------------------

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);

    const now = performance.now();
    if (now - this.lastDraw < FRAME_MS) return;   // preskok do ~30 fps
    this.lastDraw = now;

    const t = now - this.t0;
    this.draw(t);
    this.paintText(t);
  };

  private draw(t: number){
    const cols = this.cols, rows = this.rows;
    if (!cols || !rows) return;

    const time = t / 1000;

    // More se budi IZ PRAZNINE: na početku je i amplituda mala i srednji nivo
    // nizak, pa ekran krene kao rijetka prašina znakova pa se ispuni. Da raste
    // samo amplituda, prvi kadar bi bio ravan zid od jednog te istog znaka.
    const grow = smooth01(t / 900);
    let amp = 0.16 + 0.84 * grow;
    const base = 0.06 + 0.44 * grow;
    if (t > T_EXIT) amp *= 1 + 0.9 * smooth01((t - T_EXIT) / 420);

    // Voda se RAZMAKNE oko identiteta — u elipsi ispod loga gustina pada ka
    // nuli, pa u moru ostane rupa u koju identitet stane.
    const calm = 0.9 * smooth01((t - T_MARK) / 640);

    const ax = this.ax, by = this.by, sinQ = this.sinQ, cosQ = this.cosQ;
    const sinP = this.sinP, cosP = this.cosP;
    const dist = this.dist, pool = this.pool;

    for (let x = 0; x < cols; x++) ax[x] = 0.55 * Math.sin(x * KX + time * SX);
    for (let y = 0; y < rows; y++) {
      by[y] = 0.45 * Math.sin(y * KY + time * SY);
      const q = y * KDY + time * SD;
      sinQ[y] = Math.sin(q);
      cosQ[y] = Math.cos(q);
    }

    // Aktivni udari: prsten poluprečnika r, jačine a.
    const rr: number[] = [];
    const ra: number[] = [];
    for (const p of PULSES) {
      const s = (t - p.at) / PULSE_MS;
      if (s < 0 || s > 1) continue;
      rr.push(p.dir === 1 ? s * PULSE_REACH : (1 - s) * PULSE_REACH);
      // Val koji odlazi slabi; val koji se skuplja ka centru JAČA.
      ra.push(p.dir === 1 ? p.amp * (1 - s) : p.amp * s);
    }
    const rn = rr.length;
    const spark = !this.reduced;

    let deep = '', crest = '';
    let i = 0;
    for (let y = 0; y < rows; y++) {
      const b = by[y], sq = sinQ[y], cq = cosQ[y];
      for (let x = 0; x < cols; x++, i++) {

        let h = (ax[x] + b + sinP[x] * cq + cosP[x] * sq) * WSUM;

        for (let p = 0; p < rn; p++) {
          const u = (dist[i] - rr[p]) / PULSE_W;
          if (u > -1 && u < 1) { const k = 1 - u * u; h += ra[p] * k * k; }
        }

        let v = h * amp * 0.5 + base;
        v *= 1 - calm * pool[i];
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        const idx = (v * RAMP_LAST + 0.5) | 0;

        if (idx >= CREST_FROM) {
          crest += (spark && Math.random() < SPARK_P)
            ? NOISE[(Math.random() * NOISE.length) | 0]
            : RAMP[idx];
          deep += ' ';
        } else {
          deep += RAMP[idx];
          crest += ' ';
        }
      }
      deep += '\n';
      crest += '\n';
    }

    this.deepRef.nativeElement.textContent = deep;
    this.crestRef.nativeElement.textContent = crest;
  }

  /** Natpis se dekodira iz šuma slijeva nadesno; mjerač se puni do gašenja. */
  private paintText(t: number){
    if (!this.tagDone && t >= T_TAG) {
      const locked = Math.min(TAGLINE.length,
        Math.floor(((t - T_TAG) / T_DECODE) * TAGLINE.length));
      this.paintTag(this.noise(locked));
      if (locked >= TAGLINE.length) this.tagDone = true;
    }

    if (t >= T_METER) {
      const n = Math.min(METER_CELLS,
        Math.round(((t - T_METER) / (T_EXIT - T_METER)) * METER_CELLS));
      if (n !== this.meterShown) {
        this.meterShown = n;
        this.meterRef.nativeElement.textContent = meterText(n);
      }
    }
  }

  /** „JEBA" ide u volt raspon, ostatak u mirniji — a linija je jedna te ista. */
  private paintTag(s: string){
    this.leadRef.nativeElement.textContent = s.slice(0, LEAD.length);
    this.tailRef.nativeElement.textContent = s.slice(LEAD.length);
  }

  /** Prvih `locked` znakova pravo, ostatak šum; razmaci se ne diraju. */
  private noise(locked: number): string {
    let out = TAGLINE.slice(0, locked);
    for (let i = locked; i < TAGLINE.length; i++) {
      out += TAGLINE[i] === ' ' ? ' ' : NOISE[(Math.random() * NOISE.length) | 0];
    }
    return out;
  }
}
