import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy } from '@angular/core';

/**
 * Organski klaster balončića — Markova vizija za reakcije na blogu:
 * „balončići koji lebde i kao da se privlače među sobom... povezani
 * gravitacijom ili nevidljivim strunama... da se pomjeraju kad mišem
 * pređemo preko njih".
 *
 * KAKO RADI
 *
 * Direktiva preuzme pozicioniranje svoje djece (.rx-b): svaki balončić je
 * tijelo u maloj simulaciji — opruga ga vuče ka njegovom „domu" u grozdu
 * (zlatni ugao oko sidra), parovi se privlače na daljini a odbijaju kad se
 * sudare (nevidljive strune), svako tijelo diše svojim sinusnim lelujanjem,
 * a pokazivač ih nježno razmiče. Petlja ide kroz requestAnimationFrame VAN
 * Angular zone i piše transform direktno — nula change detectiona po kadru.
 *
 * Djeca se dodaju/sklanjaju kroz Angular (*ngFor) — MutationObserver
 * usklađuje tijela, a postojeća zadržavaju pozicije (bez preskoka).
 *
 * `prefers-reduced-motion`: direktiva se uopšte ne pali — ostaje običan
 * red (flex), bez ijednog pokreta.
 */

interface Body {
  el: HTMLElement;
  x: number; y: number;      // pozicija CENTRA; origin = donji-lijevi ugao, y NAGORE
  vx: number; vy: number;
  hx: number; hy: number;    // „dom" — slot u grozdu
  r: number;                 // poluprečnik sudara (pola šire strane)
  rw: number; rh: number;    // pola širine/visine — pilula nije krug
  phase: number;             // faza lelujanja
  freq: number;
}

/**
 * Domovi u grozdu — ručno štimovan rasip gore-desno od [+] sidra (spirala
 * po zlatnom uglu je pravila vertikalni stub uz lijevu ivicu). Preko osam
 * balončića se vrti u krug — grupa ima šest ljudi, dovoljno je.
 */
const SLOTS: [number, number][] = [
  [46, 22], [100, 36], [52, 66], [112, 82],
  [158, 34], [166, 92], [206, 58], [78, 104]
];

@Directive({
  selector: '[appBubbles]',
  standalone: true
})
export class BubblePhysicsDirective implements AfterViewInit, OnDestroy {

  private bodies = new Map<HTMLElement, Body>();
  private order: HTMLElement[] = [];
  private raf = 0;
  private lastT = 0;
  private mo: MutationObserver | null = null;
  private pointer = { x: 0, y: 0, on: false };
  private onMove = (e: PointerEvent) => this.trackPointer(e);
  private enabled = false;

  constructor(private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.enabled = true;
    this.host.nativeElement.classList.add('bp-on');
    this.sync();

    this.mo = new MutationObserver(() => this.sync());
    this.mo.observe(this.host.nativeElement, { childList: true });

    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove, { passive: true });
      this.lastT = performance.now();
      this.raf = requestAnimationFrame(t => this.tick(t));
    });
  }

  ngOnDestroy() {
    this.mo?.disconnect();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
  }

  /** Uskladi tijela sa DOM-om: nova dobiju slot i uđu iz sidra, stara ostaju. */
  private sync() {
    if (!this.enabled) return;

    const els = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.rx-b'));
    for (const key of [...this.bodies.keys()]) {
      if (!els.includes(key)) this.bodies.delete(key);
    }

    els.forEach((el, i) => {
      const [hx, hy] = SLOTS[i % SLOTS.length];

      const rw = (el.offsetWidth / 2) || 22;
      const rh = (el.offsetHeight / 2) || 14;

      const existing = this.bodies.get(el);
      if (existing) {
        existing.hx = hx;
        existing.hy = hy;
        existing.r = Math.max(rw, rh);
        existing.rw = rw;
        existing.rh = rh;
        return;
      }

      this.bodies.set(el, {
        el,
        x: 26, y: 12,          // rađa se kod sidra pa ga opruga odvuče u slot
        vx: 0, vy: 0,
        hx, hy,
        r: Math.max(rw, rh),
        rw, rh,
        phase: i * 1.7 + (el.textContent?.length ?? 0),
        freq: 0.9 + (i % 3) * 0.35
      });
    });

    this.order = els;
  }

  private trackPointer(e: PointerEvent) {
    const rect = this.host.nativeElement.getBoundingClientRect();
    // Origin simulacije je donji-lijevi ugao kontejnera, y raste NAGORE.
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = rect.bottom - e.clientY;
    this.pointer.on =
      e.clientX > rect.left - 40 && e.clientX < rect.right + 40 &&
      e.clientY > rect.top - 40 && e.clientY < rect.bottom + 40;
  }

  private tick(t: number) {
    const dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;

    const host = this.host.nativeElement;
    const W = host.clientWidth || 220;
    const H = host.clientHeight || 110;
    const bodies = this.order.map(el => this.bodies.get(el)!).filter(Boolean);

    for (const b of bodies) {
      let fx = 0, fy = 0;

      // Opruga ka domu u grozdu — drži jato na okupu bez krutog reda.
      fx += (b.hx - b.x) * 14;
      fy += (b.hy - b.y) * 14;

      // Disanje: svako tijelo leluja svojim ritmom.
      fx += Math.sin(t / 1000 * b.freq + b.phase) * 16;
      fy += Math.cos(t / 1000 * b.freq * 0.8 + b.phase * 1.3) * 12;

      // Pokazivač nježno razmiče jato.
      if (this.pointer.on) {
        const dx = b.x - this.pointer.x;
        const dy = b.y - this.pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 90 && d > 0.01) {
          const push = (1 - d / 90) * 620;
          fx += (dx / d) * push;
          fy += (dy / d) * push;
        }
      }

      b.vx = (b.vx + fx * dt) * 0.90;
      b.vy = (b.vy + fy * dt) * 0.90;
    }

    // Nevidljive strune: parovi se odbijaju kad se sudare, blago privlače
    // na srednjoj daljini — grozd, ne rešetka.
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], c = bodies[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + c.r + 6;

        let f = 0;
        if (d < min) f = (d - min) * 26;                    // sudar: razdvoji
        else if (d < min + 46) f = (d - (min + 24)) * 2.2;  // struna: privuci

        const ux = dx / d, uy = dy / d;
        a.vx += ux * f * dt; a.vy += uy * f * dt;
        c.vx -= ux * f * dt; c.vy -= uy * f * dt;
      }
    }

    for (const b of bodies) {
      b.x = Math.min(Math.max(b.x + b.vx * dt, b.rw), W - b.rw);
      b.y = Math.min(Math.max(b.y + b.vy * dt, b.rh), H - b.rh);
      // Dijete je usidreno na left:0/bottom:0 — pomak postavlja CENTAR na (x, y).
      b.el.style.transform =
        `translate3d(${(b.x - b.rw).toFixed(1)}px, ${(-(b.y - b.rh)).toFixed(1)}px, 0)`;
    }

    this.raf = requestAnimationFrame(t2 => this.tick(t2));
  }
}
