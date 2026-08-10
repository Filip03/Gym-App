import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AudioService } from '../../services/audio.service';
import { BlogService, BlogMediaItem, BlogReaction } from '../../services/blog.service';
import { compressImage } from '../../shared/image-compress';
import { compressVideo } from '../../shared/video-compress';
import { ProfileService } from '../../services/profile.service';

/** Objave jednog perioda — „Danas", „Juče", „Jul 2026"… */
interface BlogGroup {
  key: string;
  label: string;
  items: BlogMediaItem[];
}

const MONTHS = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
];

/** Paleta reakcija — emoji je i vrijednost u bazi (blog_reactions.kind). */
const REACTION_KINDS = ['💪', '🔥', '🐐', '😂', '❤️'];

/** Jedan balončić na objavi: vrsta + koliko + čije glave + da li i moja. */
interface ReactionBubble {
  kind: string;
  count: number;
  mine: boolean;
  /** Profilne slike reaktora, najviše tri — Markova želja: „sa slikama profilnih". */
  avatars: string[];
}

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  /** Traka od tri panela u pregledu — prst je vuče uživo (bez CD po kadru). */
  @ViewChild('lbStrip') lbStripRef?: ElementRef<HTMLElement>;

  loading = true;
  errorMessage = '';

  mediaItems: BlogMediaItem[] = [];

  uploading = false;
  uploadError = '';
  compressing = false;
  compressProgress = 0;

  /** Objave grupisane po periodu — struktura umjesto jedne beskonačne mreže. */
  groups: BlogGroup[] = [];
  /** Ravan spisak istim redom kao na ekranu — za kretanje kroz pregled. */
  private flat: BlogMediaItem[] = [];

  private usernames = new Map<string, string>();
  private avatars = new Map<string, string | null>();
  currentUserId = '';

  selectedIndex = -1;

  /** Korisnik čiji se pregled profila trenutno prikazuje (klik na profilnu sliku). */

  private userId = '';

  constructor(
    private authService: AuthService,
    private audio: AudioService,
    private blogService: BlogService,
    private profileService: ProfileService,
    private zone: NgZone
  ) {}

  get selectedItem(): BlogMediaItem | null {
    return this.selectedIndex >= 0 ? this.flat[this.selectedIndex] ?? null : null;
  }

  /** Susjedi u pregledu — bočni paneli trake, da prevlačenje ima šta da dovuče. */
  get prevItem(): BlogMediaItem | null {
    return this.selectedIndex > 0 ? this.flat[this.selectedIndex - 1] ?? null : null;
  }
  get nextItem(): BlogMediaItem | null {
    return this.selectedIndex >= 0 ? this.flat[this.selectedIndex + 1] ?? null : null;
  }

  get total(): number { return this.flat.length; }



  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Nisi ulogovan.';
      this.loading = false;
      return;
    }

    this.userId = user.id;
    this.currentUserId = user.id;

    // Imena se povlače paralelno; ako padnu, objave se i dalje prikazuju samo
    // bez autora — galerija ne smije da zavisi od toga.
    void this.profileService.getAllProfiles()
      .then(list => list.forEach(p => {
        this.usernames.set(p.id, p.username);
        this.avatars.set(p.id, p.avatarUrl);
      }))
      .catch(() => {});

    await this.loadMedia();
  }

  private async loadMedia() {
    this.loading = true;
    this.errorMessage = '';

    try {
      // Reakcije stižu uporedo; ako padnu, galerija živi i bez njih.
      const [media] = await Promise.all([
        this.blogService.listMedia(),
        this.blogService.listReactions()
          .then(rows => this.indexReactions(rows))
          .catch(() => {})
      ]);
      this.mediaItems = media;
      this.buildGroups();
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju sadržaja.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Slaže objave u periode: Danas, Juče, Ove sedmice, pa po mjesecima.
   *
   * Ravna mreža od pedeset slika nema nikakav ritam — ne vidi se ni kad je šta
   * bilo, ni da je nešto novo. Zaglavlja daju vremensku os bez ijednog dodatnog
   * podatka; datum objave već postoji.
   */
  private buildGroups() {
    const today = this.startOfDay(new Date());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    const map = new Map<string, BlogGroup>();

    for (const item of this.mediaItems) {
      const d = item.createdAt ? new Date(item.createdAt) : null;
      let key: string, label: string;

      if (!d || isNaN(d.getTime())) {
        key = 'x'; label = 'Bez datuma';
      } else {
        const day = this.startOfDay(d);
        if (day.getTime() === today.getTime())          { key = 'd0'; label = 'Danas'; }
        else if (day.getTime() === yesterday.getTime()) { key = 'd1'; label = 'Juče'; }
        else if (day > weekAgo)                          { key = 'w';  label = 'Ove sedmice'; }
        else {
          key = `${d.getFullYear()}-${d.getMonth()}`;
          label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        }
      }

      const group = map.get(key) ?? { key, label, items: [] };
      group.items.push(item);
      map.set(key, group);
    }

    this.groups = [...map.values()];
    this.flat = this.groups.flatMap(g => g.items);
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  authorOf(item: BlogMediaItem): string {
    if (!item.ownerId) return '—';
    return this.usernames.get(item.ownerId) ?? '—';
  }

  avatarOf(item: BlogMediaItem): string | null {
    return item.ownerId ? this.avatars.get(item.ownerId) ?? null : null;
  }

  isMine(item: BlogMediaItem): boolean {
    return !!item.ownerId && item.ownerId === this.currentUserId;
  }

  sizeLabel(bytes: number): string {
    if (!bytes) return '';
    return bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
      : `${Math.round(bytes / 1024)} kB`;
  }

  /** `Math` u predlošku — za ograničavanje kašnjenja animacije. */
  readonly Math = Math;

  // --- Reakcije ---------------------------------------------------------------
  //
  // Balončići u uglu objave koji se NAKUPLJAJU: emoji + glave reaktora +
  // broj. Dodir na [+] otvori paletu; dodir na balončić dodaje/skida MOJU
  // reakciju te vrste (toggle). Optimistički: prikaz se mijenja odmah, upis
  // ide u pozadini, a na grešku se vrati.

  readonly reactionKinds = REACTION_KINDS;
  /** Sve reakcije po objavi (media id → redovi). */
  private reactionsByMedia = new Map<string, BlogReaction[]>();

  /**
   * Paleta je JEDNA, na nivou komponente, `position: fixed` uz dodirnuto [+]
   * — unutar kartice ju je sjekao `overflow: hidden` (Markova prijava), a
   * `content-visibility` na kartici ubija i fixed u njoj.
   */
  paletteItem: BlogMediaItem | null = null;
  paletteClosing = false;
  /** Tačka sidra palete — gornji-lijevi ugao [+] dugmeta, viewport koordinate. */
  paletteX = 0;
  paletteY = 0;
  /** Paleta otvorena NAGORE ili NADOLJE — zavisi od mjesta na ekranu. */
  paletteUp = true;
  /** Polje za custom emoji unutar palete. */
  customOpen = false;
  customEmoji = '';
  private paletteTimer: any = null;

  /**
   * ASCII/emoji prskalica na dodatu reakciju — Markov registar („tony stark
   * / ascii efekti"): glifovi prsnu iz tačke dodira i izblijede.
   */
  burst: { x: number; y: number; parts: { ch: string; dx: number; dy: number; rot: number; delay: number; big: boolean }[] } | null = null;
  private burstTimer: any = null;
  private burstSeq = 0;

  private indexReactions(rows: BlogReaction[]) {
    const map = new Map<string, BlogReaction[]>();
    for (const r of rows) {
      const list = map.get(r.mediaId) ?? [];
      list.push(r);
      map.set(r.mediaId, list);
    }
    this.reactionsByMedia = map;
  }

  /** Balončići jedne objave — po vrsti, najbrojniji prvi, stabilno za trackBy. */
  bubblesOf(item: BlogMediaItem): ReactionBubble[] {
    const rows = this.reactionsByMedia.get(item.id) ?? [];
    if (rows.length === 0) return [];

    const byKind = new Map<string, BlogReaction[]>();
    for (const r of rows) {
      const list = byKind.get(r.kind) ?? [];
      list.push(r);
      byKind.set(r.kind, list);
    }

    return [...byKind.entries()]
      .map(([kind, list]) => ({
        kind,
        count: list.length,
        mine: list.some(r => r.profileId === this.currentUserId),
        avatars: list
          .map(r => this.avatars.get(r.profileId) ?? null)
          .filter((a): a is string => !!a)
          .slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
  }

  trackBubble = (_: number, b: ReactionBubble) => b.kind;

  togglePalette(item: BlogMediaItem, event: Event) {
    event.stopPropagation();
    if (this.paletteItem?.id === item.id && !this.paletteClosing) { this.closePalette(); return; }

    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const PAL_H = 50;   // visina pilule — uračunata u sidro kad ide nagore

    clearTimeout(this.paletteTimer);
    this.paletteClosing = false;
    this.customOpen = false;
    this.customEmoji = '';
    // Ne smije van desne ivice (custom polje je proširi do ~310px).
    this.paletteX = Math.max(8, Math.min(r.left, window.innerWidth - 318));
    // Pri vrhu ekrana nema mjesta iznad — paleta se otvara ispod dugmeta.
    this.paletteUp = r.top > 170;
    this.paletteY = this.paletteUp ? r.top - 10 - PAL_H : r.bottom + 10;
    this.paletteItem = item;
  }

  closePalette() {
    if (!this.paletteItem || this.paletteClosing) return;
    this.paletteClosing = true;
    clearTimeout(this.paletteTimer);
    this.paletteTimer = setTimeout(() => {
      this.paletteItem = null;
      this.paletteClosing = false;
      this.customOpen = false;
    }, 260);
  }

  /** Dodir van palete je zatvara; listanje takođe — fiksna ne smije da lebdi. */
  @HostListener('document:click')
  onDocClick() { this.closePalette(); }
  @HostListener('window:wheel')
  @HostListener('window:touchmove')
  onDocScroll() { if (this.paletteItem && !this.paletteClosing) this.closePalette(); }

  /**
   * Custom emoji: bilo koji znak van ASCII opsega (telefon nudi emoji
   * tastaturu). Uzima se prva „grafema" — 💪🏿 i slične sekvence ostaju cijele.
   */
  submitCustomEmoji(event: Event) {
    event.stopPropagation();
    const raw = this.customEmoji.trim();
    if (!raw || /^[\x00-\x7F]+$/.test(raw)) { this.customEmoji = ''; return; }

    let first = raw;
    try {
      const seg = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
      first = seg.segment(raw)[Symbol.iterator]().next().value?.segment ?? raw;
    } catch {
      first = [...raw].slice(0, 2).join('');
    }

    if (this.paletteItem) void this.toggleReaction(this.paletteItem, first, event);
    this.customEmoji = '';
  }

  async toggleReaction(item: BlogMediaItem, kind: string, event: Event) {
    event.stopPropagation();
    if (!this.currentUserId) return;

    const rows = this.reactionsByMedia.get(item.id) ?? [];
    const mineIdx = rows.findIndex(r => r.profileId === this.currentUserId && r.kind === kind);

    // Odmah na ekran, pa tek onda mreža — reakcija mora da PUKNE pod prstom.
    if (mineIdx >= 0) rows.splice(mineIdx, 1);
    else {
      rows.push({ mediaId: item.id, profileId: this.currentUserId, kind });
      this.fireBurst(event, kind);
    }
    this.reactionsByMedia.set(item.id, rows);
    this.closePalette();

    try {
      await this.blogService.toggleReaction(item.id, this.currentUserId, kind);
    } catch {
      // Vrati kako je bilo — bolje pošten korak nazad nego lažni balončić.
      if (mineIdx >= 0) rows.push({ mediaId: item.id, profileId: this.currentUserId, kind });
      else {
        const i = rows.findIndex(r => r.profileId === this.currentUserId && r.kind === kind);
        if (i >= 0) rows.splice(i, 1);
      }
      this.reactionsByMedia.set(item.id, rows);
    }
  }

  /** Prskalica iz tačke dodira: izabrani emoji + ASCII glifovi iz registra. */
  private fireBurst(event: Event, kind: string) {
    const el = event.currentTarget as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    if (!r) return;

    const GLYPHS = ['+', '*', '×', '▲', '█', '░', '·', '>', '/'];
    const seq = ++this.burstSeq;
    const parts = Array.from({ length: 12 }, (_, i) => {
      // Bez Math.random u petlji rendera nije problem — ovo je jednokratno.
      const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 34 + Math.random() * 42;
      const big = i % 4 === 0;
      return {
        ch: big ? kind : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist - 18,
        rot: (Math.random() - 0.5) * 140,
        delay: Math.floor(Math.random() * 90),
        big
      };
    });

    this.burst = { x: r.left + r.width / 2, y: r.top + r.height / 2, parts };
    clearTimeout(this.burstTimer);
    this.burstTimer = setTimeout(() => {
      if (seq === this.burstSeq) this.burst = null;
    }, 820);
  }

  triggerUpload() {
    this.audio.play('blogAdd');
    if (this.uploading || this.compressing) return;
    this.fileInputRef.nativeElement.click();
  }

  indexOf(item: BlogMediaItem): number { return this.flat.indexOf(item); }

  next() { if (this.selectedIndex < this.flat.length - 1) this.selectedIndex++; }
  prev() { if (this.selectedIndex > 0) this.selectedIndex--; }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (this.selectedIndex < 0) return;
    if (event.key === 'Escape')     this.closeLightbox();
    if (event.key === 'ArrowRight') this.next();
    if (event.key === 'ArrowLeft')  this.prev();
  }

  // --- Prevlačenje u pregledu — slika PRATI prst -----------------------------
  //
  // Ranije: prag na touchend pa trenutni skok na susjednu sliku — „uopšte
  // nije smooth" (Markova prijava). Sada traka od tri panela (prethodna,
  // tekuća, sljedeća) klizi pod prstom uživo, a na puštanju se sa oprugom
  // prelije na cilj ili vrati. Nadolje: slika tone za prstom uz tamnjenje,
  // pa flick zatvori pregled.
  //
  // IZVEDBA BEZ CD-a PO KADRU: touchmove se kači ručno VAN Angular zone i
  // piše transform direktno u stil — 60fps bez change detectiona; Angular se
  // budi tek na kraju (promjena indeksa/zatvaranje).

  private touchX = 0;
  private touchY = 0;
  /** Osovina poteza se ZAKLJUČA na prvih ~10px — poslije nema preskakanja. */
  private dragAxis: 'h' | 'v' | null = null;
  private lastDx = 0;
  private lastDy = 0;
  /** Šta uraditi kad tranzicija trake završi: pomak indeksa ili zatvaranje. */
  private pendingStep = 0;
  private pendingClose = false;
  private moveHandler: ((e: TouchEvent) => void) | null = null;

  private get strip(): HTMLElement | null {
    return this.lbStripRef?.nativeElement ?? null;
  }

  onTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1 || this.pendingStep || this.pendingClose) return;
    this.touchX = event.touches[0].clientX;
    this.touchY = event.touches[0].clientY;
    this.dragAxis = null;
    this.lastDx = this.lastDy = 0;

    this.strip?.classList.remove('snap');

    this.moveHandler = (e: TouchEvent) => this.onStripMove(e);
    this.zone.runOutsideAngular(() =>
      document.addEventListener('touchmove', this.moveHandler!, { passive: false }));
  }

  private onStripMove(event: TouchEvent) {
    const t = event.touches[0];
    const strip = this.strip;
    if (!t || !strip) return;

    const dx = t.clientX - this.touchX;
    const dy = t.clientY - this.touchY;

    if (!this.dragAxis) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      this.dragAxis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    }

    event.preventDefault();

    if (this.dragAxis === 'h') {
      // Na krajevima traka pruža otpor — dovuče se malo pa hoće nazad.
      const atEdge = (dx > 0 && this.selectedIndex === 0)
        || (dx < 0 && this.selectedIndex === this.total - 1);
      this.lastDx = atEdge ? dx * 0.35 : dx;
      strip.style.transform = `translateX(calc(-33.3333% + ${this.lastDx.toFixed(1)}px))`;
    } else {
      this.lastDy = Math.max(0, dy);
      strip.style.transform =
        `translateX(-33.3333%) translateY(${this.lastDy.toFixed(1)}px)`;
      // Pozadina blijedi što je slika niže — vidi se kuda vodi pokret.
      strip.parentElement?.style.setProperty(
        '--lb-fade', Math.max(0.25, 1 - this.lastDy / 420).toFixed(3));
    }
  }

  onTouchEnd() {
    if (this.moveHandler) {
      document.removeEventListener('touchmove', this.moveHandler);
      this.moveHandler = null;
    }

    const strip = this.strip;
    if (!strip || !this.dragAxis) { this.dragAxis = null; return; }

    strip.classList.add('snap');

    if (this.dragAxis === 'h') {
      if (this.lastDx < -70 && this.selectedIndex < this.total - 1) {
        this.pendingStep = 1;
        strip.style.transform = 'translateX(-66.6667%)';
      } else if (this.lastDx > 70 && this.selectedIndex > 0) {
        this.pendingStep = -1;
        strip.style.transform = 'translateX(0%)';
      } else {
        strip.style.transform = 'translateX(-33.3333%)';
      }
    } else {
      if (this.lastDy > 110) {
        this.pendingClose = true;
        strip.style.transform = 'translateX(-33.3333%) translateY(70vh)';
        strip.parentElement?.style.setProperty('--lb-fade', '0');
      } else {
        strip.style.transform = 'translateX(-33.3333%)';
        strip.parentElement?.style.setProperty('--lb-fade', '1');
      }
    }

    this.dragAxis = null;
    this.lastDx = this.lastDy = 0;
  }

  /** Kraj klizanja trake — tek SADA se mijenja indeks, pa nema duplog skoka. */
  onStripTransitionEnd(event: TransitionEvent) {
    if (event.target !== this.strip || event.propertyName !== 'transform') return;

    if (this.pendingClose) {
      this.pendingClose = false;
      this.closeLightbox();
      return;
    }

    if (this.pendingStep) {
      this.selectedIndex += this.pendingStep;
      this.pendingStep = 0;
      const strip = this.strip;
      if (strip) {
        // Paneli su se preslagali oko novog indeksa — traka se bez animacije
        // vrati u sredinu, oko ne vidi ništa (isti piksel).
        strip.classList.remove('snap');
        strip.style.transform = 'translateX(-33.3333%)';
      }
    }
  }

  openLightbox(item: BlogMediaItem) {
    this.selectedIndex = this.indexOf(item);
    this.pendingStep = 0;
    this.pendingClose = false;
  }

  closeLightbox() {
    this.selectedIndex = -1;
    this.pendingStep = 0;
    this.pendingClose = false;
  }

  ngOnDestroy() {
    if (this.moveHandler) document.removeEventListener('touchmove', this.moveHandler);
    clearTimeout(this.paletteTimer);
    clearTimeout(this.burstTimer);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    this.uploadError = '';

    let toUpload = file;

    try {
      if (file.type.startsWith('image/')) {
        this.compressing = true;
        toUpload = await compressImage(file);
      } else if (file.type.startsWith('video/')) {
        this.compressing = true;
        this.compressProgress = 0;
        toUpload = await compressVideo(file, ratio => this.compressProgress = ratio);
      }
    } catch {
      // Kompresija ne uspije (npr. stariji browser bez podrške) — otpremi original
      // umjesto da korisniku blokiraš upload zbog neobavezne optimizacije.
      toUpload = file;
    } finally {
      this.compressing = false;
    }

    this.uploading = true;

    try {
      await this.blogService.uploadMedia(toUpload, this.userId);
      await this.loadMedia();
    } catch (err: any) {
      this.uploadError = err.message ?? 'Greška prilikom otpremanja fajla.';
    } finally {
      this.uploading = false;
    }
  }
}
