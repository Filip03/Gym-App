import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service'
import { CacheService } from '../../services/cache.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { NavModeService } from '../../services/nav-mode.service';
import { LastRouteService } from '../../services/last-route.service';

interface DockItem {
  icon: string;
  label: string;
  /** null = radnja, ne ruta (odjava). Tjeme ne sjeda na takvu stavku. */
  route: string | null;
}

/**
 * Donja navigacija — dva izgleda, isti sadržaj.
 *
 * KLASIČNI (`dome === false`) je zatečeni ravan red ikona i podrazumijevani je;
 * sav kod ispod tiče se isključivo KUPOLE i ne izvršava se dok je korisnik ne
 * upali u Profil → Podešavanja → Meni.
 *
 * GEOMETRIJA KUPOLE
 *   Luk je elipsa: `border-radius: 50% 50% 0 0 / rise rise 0 0`. Za vodoravnu
 *   udaljenost `x` od sredine, rub luka pada za
 *       dip(x) = rise * (1 - sqrt(1 - (x / half)^2))
 *   Ikone stoje na TOJ ISTOJ krivoj, samo spuštene za `crestY`, pa uvijek prate
 *   rub kupole — bez obzira na širinu ekrana.
 *
 *   `pos` je pozicija tjemena izražena u slotovima (0..5, necjelobrojna dok se
 *   prevlači). Sve ostalo se izvodi iz nje: bliskost ikone tjemenu je Gausova
 *   kriva `near = e^(-u²/0.62)`, koja daje uvećanje, izdizanje i boju.
 *
 * POKRET (kućni jezik — vidi skill `tecne-animacije`)
 *   - prevlačenje: kupola se stisne (squash), točak se elastično „navije" (tilt)
 *   - puštanje:    opruga vraća tjeme na najbliži slot, kupola slegne
 *   - promjena rute: ink-bloom kap kreće IZ TJEMENA i razlije se kroz kupolu
 *   - ulazak:      ikone izranjaju talasom, sa kašnjenjem po slotu
 *   `prefers-reduced-motion` gasi sve — tjeme onda samo preskoči na cilj.
 */
@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnDestroy {

  /** Koji izgled je na ekranu; mijenja ga NavModeService, uživo. */
  dome = false;

  /**
   * Kupola se pojavljuje i nestaje kroz `*ngIf`, pa se ne može uhvatiti jednom
   * u `ngAfterViewInit` — Angular zove OVAJ setter na svaku promjenu režima.
   */
  @ViewChild('dock') set dockEl(ref: ElementRef<HTMLElement> | undefined) {
    const el = ref?.nativeElement ?? null;
    if (el === this.dock) return;
    this.teardownDock();
    this.dock = el;
    // Djeca `*ngFor`-a postoje tek kad se cijeli pogled ispiše.
    if (el) setTimeout(() => this.initDock(), 0);
  }

  /** Iste stavke i isti redoslijed kao u klasičnom futeru. */
  readonly items: DockItem[] = [
    { icon: 'home',           label: 'Planovi',    route: '/dashboard'   },
    { icon: 'fitness_center', label: 'Vježbe',     route: '/exercices'   },
    { icon: 'leaderboard',    label: 'Rang lista', route: '/leaderboard' },
    { icon: 'account_circle', label: 'Profil',     route: '/profiles'    },
    { icon: 'diversity_1',    label: 'Ekipa',      route: '/blog'        },
    { icon: 'logout',         label: 'Odjava',     route: null           },
  ];

  /** Zarezi na luku — po jedan u svakom razmaku između ikona. */
  readonly tickSlots = [0.5, 1.5, 2.5, 3.5, 4.5];

  // --- čvorovi kupole -------------------------------------------------------
  private dock: HTMLElement | null = null;
  private surface: HTMLElement | null = null;
  private crest: HTMLElement | null = null;
  private itemEls: HTMLElement[] = [];
  private tickEls: HTMLElement[] = [];

  // --- geometrija (px, preračunava se na svaku promjenu širine) -------------
  private half = 1;      // vodoravna poluosa elipse kupole
  private rise = 0;      // pad luka od tjemena do ivice elipse
  private step = 60;     // vodoravni razmak između slotova
  private readonly crestY = 35;   // visina centra ikone u tjemenu, od vrha doka

  // --- stanje ---------------------------------------------------------------
  private pos = 0;       // trenutna pozicija tjemena u slotovima
  private target = 0;    // slot na koji opruga vuče
  private tilt = 0;      // „navijenost" točka u stepenima

  /**
   * Trenutna ruta nije nijedna stavka doka (npr. /training). Tjeme tada miruje
   * na SREDINI luka, između ikona — bez ležišta na ikoni — a prevlačenje koje
   * se ne završi jasnim izborom (pointercancel, povratak na sredinu) ne vodi
   * NIGDJE. Ranije je tjeme sjedalo na slot 0, pa je iOS sistemski gest usred
   * treninga umio da odvede na /dashboard.
   */
  private offDock = false;

  private raf = 0;
  private anim: { from: number; to: number; tilt0: number; t0: number; dur: number } | null = null;
  private pending = false;

  private downX = 0;
  private downY = 0;
  private downPos = 0;
  private moved = false;
  private suppressClick = false;

  private reduced = false;
  private ro?: ResizeObserver;
  private navSub?: Subscription;
  private routeSub?: Subscription;

  constructor(
    private service: AuthService,
    private router: Router,
    private pushNotifications: PushNotificationService,
    private zone: NgZone,
    private nav: NavModeService,
    private lastRoute: LastRouteService,
    private cache: CacheService
  ){
    this.reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.navSub = this.nav.mode$.subscribe(m => this.dome = m === 'dome');
  }

  ngOnDestroy(): void {
    this.teardownDock();
    this.teardownFlat();
    this.navSub?.unsubscribe();
  }

  // ==========================================================================
  // Kačenje i otkačinjanje kupole
  // ==========================================================================

  private initDock(): void {
    const dock = this.dock;
    if (!dock || !dock.isConnected) return;

    this.surface = dock.querySelector<HTMLElement>('.dock-surface');
    this.crest   = dock.querySelector<HTMLElement>('.dock-crest');
    this.itemEls = Array.from(dock.querySelectorAll<HTMLElement>('.dock-item'));
    this.tickEls = Array.from(dock.querySelectorAll<HTMLElement>('.dock-tick'));

    const start = this.activeIndex();
    this.offDock = start < 0;
    dock.classList.toggle('offdock', this.offDock);
    this.pos = this.target = start < 0 ? this.restSlot() : start;
    this.tilt = 0;

    this.layout();

    // Klik se guta SAMO ako je prst stvarno prevlačio — inače tap na ikonu
    // mora da radi kao i do sada (routerLink / odjava), bez ijednog međukoraka.
    dock.addEventListener('click', this.onClickCapture, true);

    this.zone.runOutsideAngular(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.layout());
        this.ro.observe(dock);
      } else {
        window.addEventListener('resize', this.onResize);
      }
    });

    // Ruta se mijenja i tapom i prevlačenjem i mimo doka (kartica na stranici,
    // dugme „nazad") — pa reakcija kupole visi OVDJE, na jednom mjestu.
    this.routeSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        const i = this.activeIndex();
        if (i < 0) {
          // Ruta van doka (npr. /training): tjeme oprugom ode na sredinu luka
          // i tamo miruje dok se korisnik ne vrati na neku od stavki.
          if (!this.offDock) {
            this.offDock = true;
            this.dock?.classList.add('offdock');
            this.animateTo(this.restSlot());
          }
          return;
        }
        this.offDock = false;
        this.dock?.classList.remove('offdock');
        if (i === this.target) return;
        this.bloom(i);
        this.settleShake();
        this.animateTo(i);
      });
  }

  private teardownDock(): void {
    this.dock?.removeEventListener('click', this.onClickCapture, true);
    this.ro?.disconnect();
    this.ro = undefined;
    window.removeEventListener('resize', this.onResize);
    this.detach();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.pending = false;
    this.anim = null;
    this.routeSub?.unsubscribe();
    this.routeSub = undefined;
    this.dock = this.surface = this.crest = null;
    this.itemEls = [];
    this.tickEls = [];
  }

  private onClickCapture = (e: Event) => {
    if (this.suppressClick) { e.preventDefault(); e.stopPropagation(); }
  };

  private onResize = () => this.layout();

  // ==========================================================================
  // Geometrija
  // ==========================================================================

  /** Vodoravna udaljenost slota od sredine doka. */
  private xAt(slot: number): number {
    return (slot - (this.items.length - 1) / 2) * this.step;
  }

  /** Koliko luk padne na udaljenosti `x` od tjemena. */
  private dip(x: number): number {
    const t = Math.min(Math.abs(x) / this.half, 1);
    return this.rise * (1 - Math.sqrt(1 - t * t));
  }

  private layout(): void {
    const dock = this.dock, surf = this.surface;
    if (!dock || !surf) return;
    const w = dock.clientWidth;
    if (!w) return;

    // Ikone se drže uske kolone i na laptopu — na 1200 px razvučen red od šest
    // ikona preko cijelog ekrana ne bi bio ni luk ni navigacija.
    const L = Math.min(w, 520);
    const edge = Math.min(Math.max(L * 0.115, 36), 58);
    this.step = (L - 2 * edge) / (this.items.length - 1);

    // Kupola je šira od doka (viri sa strana) da je blago naginjanje ne odlijepi
    // od ivica ekrana — zato se poluosa čita sa NJE, a ne sa doka.
    this.half = Math.max(surf.offsetWidth / 2, 1);

    // `rise` se bira tako da luk na IVICI EKRANA padne za željenu mjeru;
    // ograničava ga visina kupole (border-radius se inače sam skalira).
    // 0.17/78 → 0.13/60: na uskom iPhone-u je rub luka padao toliko da su
    // krajnje ikone (home, odjava) izlazile van ekrana (Markova prijava).
    const visible = Math.min(Math.max(w * 0.13, 40), 60);
    const tEdge = Math.min((w / 2) / this.half, 1);
    const drop = Math.max(1 - Math.sqrt(1 - tEdge * tEdge), 0.08);
    this.rise = Math.min(visible / drop, Math.max(surf.offsetHeight - 8, 24));

    surf.style.setProperty('--arc-rise', this.rise.toFixed(1) + 'px');
    this.render();
  }

  // ==========================================================================
  // Crtanje — jedini metod koji dira DOM stilove
  // ==========================================================================

  private render(): void {
    if (!this.dock || !this.crest) return;
    const pos = this.pos;

    // Van doka (npr. /training), dok se ne prevlaci: NIJEDNA ikona nije
    // „bliska" tjemenu — sve leze ravno na luku, tjeme je sakriveno (CSS),
    // zarezi hladni. Inace bi tjeme na 2,5 podiglo i rang-listu i profil
    // istovremeno, kao dva izabrana taba.
    const flat = this.offDock && !this.moved;

    // tjeme — ista zaštita od isijecanja kao za ikone (ležište je 64px kutija)
    const cx = this.xAt(pos);
    const cy = Math.min(this.crestY + this.dip(cx),
                        this.dock.clientHeight - 35);
    this.crest.style.transform =
      `translate3d(${cx.toFixed(2)}px, ${(cy - 3).toFixed(2)}px, 0)`;

    // Ikona (kutija 56px, centrirana) ne smije proviriti ispod doka — na uskom
    // ekranu rub luka padne duboko, pa se krajnje ikone bez ovoga isijecaju.
    const maxY = this.dock.clientHeight - 34;

    // ikone
    for (let i = 0; i < this.itemEls.length; i++) {
      const el = this.itemEls[i];
      const u = i - pos;
      const near = flat ? 0 : Math.exp(-(u * u) / 0.62);   // 1 u tjemenu, pada u stranu
      const pull = 0.30 * u * Math.exp(-(u * u) / 2);  // magnet: klizi ka tjemenu
      const x = this.xAt(i - pull);
      const y = Math.min(this.crestY + this.dip(x) - 15 * near, maxY);
      const s = 0.84 + 0.40 * near;

      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(3)})`;
      el.style.opacity = (0.62 + 0.38 * near).toFixed(3);
      el.style.setProperty('--near', near.toFixed(3));
      el.style.zIndex = near > 0.5 ? '3' : '2';
    }

    // zarezi — pale se kad tjeme prelazi preko njih
    for (let k = 0; k < this.tickEls.length; k++) {
      const slot = this.tickSlots[k];
      const x = this.xAt(slot);
      const y = this.crestY + this.dip(x);
      const hot = flat ? 0 : Math.max(0, 1 - Math.abs(slot - pos) * 1.8);
      this.tickEls[k].style.transform =
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(1 + hot).toFixed(3)})`;
      this.tickEls[k].style.setProperty('--hot', hot.toFixed(3));
    }

    this.dock.style.setProperty('--tilt', this.tilt.toFixed(3) + 'deg');
  }

  private requestRender(): void {
    if (this.pending) return;
    this.pending = true;
    this.raf = requestAnimationFrame(() => { this.pending = false; this.render(); });
  }

  // ==========================================================================
  // Opruga
  // ==========================================================================

  /** Prebačaj pa smirenje — isti osjećaj kao `--ease-spring` u tokenima. */
  private static spring(t: number): number {
    const c1 = 1.25, c3 = c1 + 1, k = t - 1;
    return 1 + c3 * k * k * k + c1 * k * k;
  }

  private animateTo(slot: number, dur = 520): void {
    this.target = slot;
    if (this.reduced) {
      this.pos = slot; this.tilt = 0; this.render();
      return;
    }
    this.anim = { from: this.pos, to: slot, tilt0: this.tilt, t0: performance.now(), dur };
    this.zone.runOutsideAngular(() => this.loop());
  }

  private loop(): void {
    // Opruga preuzima kadar od prevlačenja; bez `pending = false` ostao bi
    // zaključan zahtjev iz `requestRender()` i sljedeće prevlačenje ne bi crtalo.
    if (this.raf) cancelAnimationFrame(this.raf);
    this.pending = false;
    const tick = () => {
      const a = this.anim;
      if (!a) { this.raf = 0; return; }
      const t = Math.min(1, (performance.now() - a.t0) / a.dur);
      const e = FooterComponent.spring(t);
      this.pos = a.from + (a.to - a.from) * e;
      this.tilt = a.tilt0 * (1 - e);
      if (t >= 1) { this.pos = a.to; this.tilt = 0; this.anim = null; }
      this.render();
      this.raf = this.anim ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  // ==========================================================================
  // Prevlačenje
  // ==========================================================================

  onDown(ev: PointerEvent): void {
    if (ev.button > 0 || !this.dock) return;

    this.anim = null;                 // prst preuzima kontrolu od opruge
    this.downX = ev.clientX;
    this.downY = ev.clientY;
    this.downPos = this.pos;
    this.moved = false;
    this.suppressClick = false;

    this.dock.classList.add('pressing');
    this.dock.classList.remove('settling');

    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove, { passive: false });
      window.addEventListener('pointerup', this.onUp);
      // Prekid pokazivača (iOS sistemski gest, dolazni poziv...) NIJE izbor —
      // ima svoj tok, koji nikad ne navigira.
      window.addEventListener('pointercancel', this.onCancel);
    });
  }

  private onMove = (ev: PointerEvent): void => {
    const dx = ev.clientX - this.downX;
    const dy = ev.clientY - this.downY;

    // Prevlačenje po doku počinje tek na ~12px PRETEŽNO VODORAVNOG pomaka.
    // Vertikalan pokret nije prevlačenje po doku nego skrol ili početak iOS
    // sistemskog gesta (izlazak iz PWA kreće uvis sa donje ivice — tačno preko
    // futera): tada se praćenje pušta, pa ostane tap ili ništa.
    if (!this.moved) {
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (ady >= 12 && adx <= ady * 1.4) { this.abandonDrag(); return; }
      if (adx < 12 || adx <= ady * 1.4) return;
      this.moved = true;
      this.dock?.classList.add('dragging');
    }
    ev.preventDefault();

    const max = this.items.length - 1;
    let p = this.downPos + dx / this.step;
    if (p < 0) p *= 0.34;                       // gumica na krajevima
    else if (p > max) p = max + (p - max) * 0.34;

    this.pos = p;
    this.tilt = Math.max(-1.1, Math.min(1.1, (p - this.downPos) * 0.5));
    this.requestRender();
  };

  private onUp = (): void => {
    this.detach();
    if (!this.dock) return;

    this.dock.classList.remove('pressing', 'dragging');

    if (!this.moved) return;            // običan tap — link/dugme rade svoje
    // poslije obrade se stanje prevlačenja gasi — van doka se sve vraća u
    // ravno mirovanje (vidi `flat` u render)
    setTimeout(() => { this.moved = false; this.requestRender(); }, 0);

    // Poslije prevlačenja pregledač ipak šalje `click` na element pod prstom;
    // taj klik nije izbor korisnika i guta se (vidi capture osluškivač gore).
    this.suppressClick = true;
    setTimeout(() => this.suppressClick = false, 140);

    const max = this.items.length - 1;
    let idx = Math.round(Math.max(0, Math.min(max, this.pos)));

    // Van doka (npr. /training) prevlačenje mora da se ZAVRŠI na nekoj stavci
    // da bi značilo izbor; puštanje blizu sredine samo vrati tjeme na počinak.
    if (this.offDock && Math.abs(this.pos - this.downPos) < 0.5) {
      this.settleShake();
      this.animateTo(this.restSlot());
      return;
    }

    if (!this.items[idx].route) {
      // Odjava se ne pokreće prevlačenjem. Tjeme se vraća na trenutnu rutu, a
      // ikona kratko trzne u crveno — „ovdje se mora tapnuti".
      this.flashQuit();
      const back = this.activeIndex();
      if (back < 0) {
        // Van doka nema slota „trenutne rute" — nazad na sredinu, bez navigacije.
        this.settleShake();
        this.animateTo(this.restSlot());
        return;
      }
      idx = back;
    }

    this.settleShake();

    const route = this.items[idx].route;
    if (route && !this.router.url.startsWith(route)) {
      // Mastilo i opruga stižu preko NavigationEnd — vidi pretplatu gore.
      this.zone.run(() => this.router.navigate([route]));
    } else {
      this.animateTo(idx);
    }
  };

  /**
   * `pointercancel`: sistem je oteo pokazivač (iOS gest izlaska, kontrolni
   * centar, dolazni poziv). To NIKAD nije izbor korisnika — nema ni jednog
   * poziva routera; tjeme se oprugom vrati na aktivni slot (van doka: sredinu).
   * Ranije je ovaj događaj dijelio tok sa `pointerup`, pa je gest izlaska iz
   * PWA usput „birao" stavku i Marko se budio na dashboardu usred treninga.
   */
  private onCancel = (): void => {
    this.detach();
    if (!this.dock) return;

    this.dock.classList.remove('pressing', 'dragging');
    if (!this.moved) return;

    // Ako poslije prekida ipak procuri click, ni on nije izbor — proguta se.
    this.suppressClick = true;
    setTimeout(() => this.suppressClick = false, 140);

    const back = this.activeIndex();
    this.settleShake();
    this.animateTo(back < 0 ? this.restSlot() : back);
    // stanje prevlačenja se gasi — van doka se ikone vraćaju u ravno mirovanje
    setTimeout(() => { this.moved = false; this.requestRender(); }, 0);
  };

  /** Vertikalan pokret: pusti praćenje prije nego što prevlačenje počne. */
  private abandonDrag(): void {
    this.detach();
    this.dock?.classList.remove('pressing');
  }

  private detach(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
  }

  // ==========================================================================
  // Mastilo i sitni signali
  // ==========================================================================

  /** Kupola slegne: stisak pa prebačaj pa mir (squash & stretch). */
  private settleShake(): void {
    if (this.reduced || !this.dock) return;
    this.dock.classList.remove('settling');
    void this.dock.offsetWidth;         // bez ovoga CSS ne ponovi animaciju
    this.dock.classList.add('settling');
  }

  /** Kap akcentne boje krene IZ TJEMENA i razlije se kroz kupolu. */
  private bloom(slot: number): void {
    const s = this.surface;
    if (this.reduced || !s) return;
    const x = this.xAt(slot);
    s.style.setProperty('--bx', `calc(50% + ${x.toFixed(1)}px)`);
    s.style.setProperty('--by', `${(this.crestY + this.dip(x)).toFixed(1)}px`);
    s.classList.remove('bloom');
    void s.offsetWidth;
    s.classList.add('bloom');
  }

  private flashQuit(): void {
    const el = this.itemEls[this.items.length - 1];
    if (!el || this.reduced) return;
    el.classList.remove('refuse');
    void el.offsetWidth;
    el.classList.add('refuse');
    setTimeout(() => el.classList.remove('refuse'), 500);
  }

  /** Slot stavke čija je ruta trenutno otvorena; -1 ako nijedna (npr. /training). */
  private activeIndex(): number {
    const url = this.router.url;
    return this.items.findIndex(it => !!it.route && url.startsWith(it.route));
  }

  /** Počinak tjemena kad je ruta van doka: sredina luka, između ikona. */
  private restSlot(): number {
    return (this.items.length - 1) / 2;
  }

  // ==========================================================================
  // KLASIČNI futer — zaštita od klika koji je zapravo bio sistemski gest
  // ==========================================================================
  //
  // Na iOS-u gest izlaska iz PWA kreće uvis sa donje ivice — tačno preko
  // futera. Pregledač pri tom umije da isporuči `click` na <a routerLink>
  // ispod prsta, pa korisnik „izabere" rutu koju nije ni takao. Zato se između
  // pointerdown i pointerup mjeri pomjeraj: preko ~10px (vertikalni je upravo
  // sistemski gest) → click se guta u capture fazi, prije RouterLink-a.
  // Tap bez pomjeranja prolazi netaknut. Isti obrazac kao suppressClick gore.

  @ViewChild('flat') set flatEl(ref: ElementRef<HTMLElement> | undefined) {
    const el = ref?.nativeElement ?? null;
    if (el === this.flat) return;
    this.teardownFlat();
    this.flat = el;
    if (el) {
      el.addEventListener('click', this.onFlatClickCapture, true);
      this.zone.runOutsideAngular(() =>
        el.addEventListener('pointerdown', this.onFlatDown));
    }
  }

  private flat: HTMLElement | null = null;
  private flatDownX = 0;
  private flatDownY = 0;
  private flatMoved = false;
  private flatSuppress = false;

  private teardownFlat(): void {
    if (!this.flat) return;
    this.flat.removeEventListener('click', this.onFlatClickCapture, true);
    this.flat.removeEventListener('pointerdown', this.onFlatDown);
    this.detachFlat();
    this.flat = null;
  }

  private onFlatDown = (ev: PointerEvent): void => {
    if (ev.button > 0) return;
    this.flatDownX = ev.clientX;
    this.flatDownY = ev.clientY;
    this.flatMoved = false;
    window.addEventListener('pointermove', this.onFlatMove, { passive: true });
    window.addEventListener('pointerup', this.onFlatUp);
    window.addEventListener('pointercancel', this.onFlatUp);
  };

  private onFlatMove = (ev: PointerEvent): void => {
    if (this.flatMoved) return;
    if (Math.abs(ev.clientX - this.flatDownX) > 10 ||
        Math.abs(ev.clientY - this.flatDownY) > 10) {
      this.flatMoved = true;
    }
  };

  private onFlatUp = (): void => {
    this.detachFlat();
    if (!this.flatMoved) return;
    this.flatSuppress = true;
    setTimeout(() => this.flatSuppress = false, 250);
  };

  private onFlatClickCapture = (e: Event): void => {
    if (this.flatSuppress) { e.preventDefault(); e.stopPropagation(); }
  };

  private detachFlat(): void {
    window.removeEventListener('pointermove', this.onFlatMove);
    window.removeEventListener('pointerup', this.onFlatUp);
    window.removeEventListener('pointercancel', this.onFlatUp);
  }

  // ==========================================================================

  async signOut(){
    // Zapamćena posljednja ruta je lična — odjava je briše, da sljedeća
    // prijava (možda tuđa, isti telefon) ne osvane na tuđem ekranu.
    const user = this.service.getCurrentUser();
    if (user) this.lastRoute.forget(user.id);

    // Isti razlog za keš: SVI lični zapisi (planovi, sesija, profil, kalendar)
    // odlaze sa odjavom — sljedeća prijava može biti tuđa. Globalni katalog i
    // šifarnici ostaju: isti su svima. Red čekanja i nacrti se NE diraju.
    if (user) this.cache.clearUser(user.id);

    // Prije signOut-a — dok Supabase sesija još važi za Authorization header.
    await this.pushNotifications.unregisterFromPush();
    await this.service.signOut();
    this.router.navigate(['/login']);
  }

}
