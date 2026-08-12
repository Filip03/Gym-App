import { AfterViewChecked, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AudioService } from '../../services/audio.service';
import { BlogService, BlogMediaItem, BlogReaction } from '../../services/blog.service';
import { compressImage } from '../../shared/image-compress';
import { compressVideo } from '../../shared/video-compress';
import { ProfileService } from '../../services/profile.service';
import { NotifyService } from '../../services/notify.service';
import { FloatLayerService } from '../../services/float-layer.service';

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


/**
 * Jedan balon = JEDNA OSOBA (Markova ispravka: grupisanje po vrsti je
 * sakrivalo ljude) — krug sa njenim emojiem i njenom profilnom slikom:
 * vidi se i KO i ŠTA na prvi pogled.
 */
interface ReactionBubble {
  kind: string;
  profileId: string;
  username: string;
  avatar: string | null;
  mine: boolean;
  /** Lična veličina balona (±15%) — determinističko iz id-ja. */
  scale: number;
}

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  /** Traka od tri panela u pregledu — prst je vuče uživo (bez CD po kadru). */
  @ViewChild('lbStrip') lbStripRef?: ElementRef<HTMLElement>;
  /** Korijen pregleda — pri otvaranju se premješta na <body> (vidi šablon). */
  @ViewChild('lbRoot') lbRootRef?: ElementRef<HTMLElement>;
  /** Tekući video u pregledu — NAŠE kontrole (nativne su gutale gestove). */
  @ViewChild('lbVideo') lbVideoRef?: ElementRef<HTMLVideoElement>;
  /** Video u kompozeru — trim ručke ga premotavaju (ref jer je pod *ngIf). */
  @ViewChild('bcVideo') bcVideoRef?: ElementRef<HTMLVideoElement>;

  // --- Naše video kontrole ----------------------------------------------------
  //
  // Nativni `controls` overlay je na iOS-u KRAO dodire — listanje preko
  // snimka nije radilo, hvatalo se samo za ivicu ekrana (Markova prijava).
  // Zato: štit preko videa nosi gestove, dodir = play/pauza, tanka traka
  // napretka + zvuk su naši.
  videoPaused = false;
  videoMuted = false;
  videoProgress = 0;

  toggleVideo(event: Event) {
    event.stopPropagation();
    const v = this.lbVideoRef?.nativeElement;
    if (!v) return;
    if (v.paused) void v.play().catch(() => this.videoPaused = true);
    else v.pause();
  }

  toggleVideoMute(event: Event) {
    event.stopPropagation();
    this.videoMuted = !this.videoMuted;
  }

  onVideoTime(v: HTMLVideoElement) {
    this.videoProgress = v.duration ? (v.currentTime / v.duration) * 100 : 0;
  }

  /** Poslije listanja na drugi snimak: novi src ne pokreće autoplay sam. */
  private kickVideo() {
    this.videoPaused = false;
    this.videoProgress = 0;
    setTimeout(() => {
      const v = this.lbVideoRef?.nativeElement;
      if (v) void v.play().catch(() => this.videoPaused = true);
    });
  }

  loading = true;
  errorMessage = '';

  mediaItems: BlogMediaItem[] = [];

  uploading = false;
  uploadError = '';
  compressing = false;
  compressProgress = 0;

  // --- Kompozer objave (Markov zahtjev: pregled + opis PRIJE objave) --------
  //
  // Izbor fajla više NE objavljuje odmah naslijepo: otvori se kartica sa
  // pregledom slike/snimka i poljem za opis — objava tek na „Objavi".
  composeFile: File | null = null;
  composeUrl = '';
  composeIsVideo = false;
  composeCaption = '';
  composeClosing = false;
  private composeCloseTimer: any = null;

  // Trim videa (Markov zahtjev): dvije ručke nad trakom — ffmpeg isiječe
  // tačno [trimStart, trimEnd]. Pregled: prevlačenje ručke premotava video,
  // a reprodukcija se vrti u izabranom rasponu.
  composeDuration = 0;
  trimStart = 0;
  trimEnd = 0;
  private trimHandle: 'l' | 'r' | null = null;

  /** Dvostepeno brisanje svoje objave: prvi dodir naoruža („Sigurno?"), drugi briše. */
  confirmDeleteId: string | null = null;
  deletingId: string | null = null;
  private confirmDeleteTimer: any = null;

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
    private notify: NotifyService,
    private floatLayer: FloatLayerService,
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
  /**
   * Polje za BILO KOJI emoji (Markova želja: sistemska tastatura, ne
   * predefinisan spisak) — fokusira se čim se rodi, emoji se primijeni čim
   * je otkucan (bez potvrde). Web ne može sam otvoriti emoji raspored —
   * korisnik ga bira na svojoj tastaturi.
   */
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

  /**
   * Baloni jedne objave — jedan po OSOBI, NAJNOVIJE ČETIRI (Markov limit:
   * više od 4 pretrpa fotografiju); ostatak stane u „+N" balon.
   */
  bubblesOf(item: BlogMediaItem): ReactionBubble[] {
    const rows = this.reactionsByMedia.get(item.id) ?? [];
    return rows.slice(-4).map(r => ({
      kind: r.kind,
      profileId: r.profileId,
      username: this.usernames.get(r.profileId) ?? '—',
      avatar: this.avatars.get(r.profileId) ?? null,
      mine: r.profileId === this.currentUserId,
      scale: this.bubbleScale(r.profileId)
    }));
  }

  hiddenCount(item: BlogMediaItem): number {
    return Math.max(0, (this.reactionsByMedia.get(item.id) ?? []).length - 4);
  }

  /** Dodir na „+N": etiketa sa svima koji nisu stali u jato. */
  onOverflowTap(item: BlogMediaItem, event: Event) {
    event.stopPropagation();
    const rows = this.reactionsByMedia.get(item.id) ?? [];
    const hidden = rows.slice(0, -4)
      .map(r => `${this.usernames.get(r.profileId) ?? '—'} ${r.kind}`)
      .join(' · ');
    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.peek = { x: r.left + r.width / 2, y: r.top - 8, text: hidden };
    clearTimeout(this.peekTimer);
    this.peekTimer = setTimeout(() => this.peek = null, 2200);
  }

  /**
   * Veličina balona po osobi, ±15% (Markova želja: dinamično a pregledno) —
   * determinističko iz id-ja, pa je isti čovjek uvijek iste veličine.
   */
  private bubbleScale(profileId: string): number {
    let h = 0;
    for (let i = 0; i < profileId.length; i++) h = (h * 31 + profileId.charCodeAt(i)) >>> 0;
    return 0.85 + (h % 31) / 100;
  }

  trackBubble = (_: number, b: ReactionBubble) => b.profileId;

  /**
   * Dodir na TUĐI balon: kratka etiketa „ko · šta" uz balon (na desktopu i
   * title radi). Dodir na SVOJ balon skida reakciju (vidi onBubbleTap).
   */
  peek: { x: number; y: number; text: string } | null = null;
  private peekTimer: any = null;

  onBubbleTap(item: BlogMediaItem, b: ReactionBubble, event: Event) {
    event.stopPropagation();
    if (b.mine) { void this.toggleReaction(item, b.kind, event); return; }

    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.peek = { x: r.left + r.width / 2, y: r.top - 8, text: `${b.username} · ${b.kind}` };
    clearTimeout(this.peekTimer);
    this.peekTimer = setTimeout(() => this.peek = null, 1400);
  }

  togglePalette(item: BlogMediaItem, event: Event) {
    event.stopPropagation();
    if (this.paletteItem?.id === item.id && !this.paletteClosing) { this.closePalette(); return; }

    const r = (event.currentTarget as HTMLElement).getBoundingClientRect();

    clearTimeout(this.paletteTimer);
    this.paletteClosing = false;
    this.customOpen = false;
    this.customEmoji = '';
    // Ne smije van desne ivice (paleta je široka do ~300px).
    this.paletteX = Math.max(8, Math.min(r.left, window.innerWidth - 308));
    // Pri vrhu ekrana nema mjesta iznad — paleta se otvara ispod dugmeta.
    // Nagore raste kroz omotač (translateY(-100%)), pa i grid ima kuda.
    this.paletteUp = r.top > 260;
    this.paletteY = this.paletteUp ? r.top - 10 : r.bottom + 10;
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

  /** Fokus na polje čim ga *ngIf rodi — da tastatura iskoči iz istog dodira. */
  @ViewChild('rxInput') set rxInput(el: ElementRef<HTMLInputElement> | undefined) {
    el?.nativeElement.focus({ preventScroll: true });
  }

  /**
   * Emoji se primjenjuje ČIM je otkucan: uzima se prva grafema (💪🏿 i slične
   * sekvence ostaju cijele), čisto ASCII kucanje se ignoriše.
   */
  onCustomEmoji(value: string, event: Event) {
    this.customEmoji = value;
    const raw = value.trim();
    if (!raw || /^[\x00-\x7F]+$/.test(raw)) return;

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

  /**
   * JEDNA reakcija po osobi (Markova odluka): ista vrsta = skidanje, druga
   * vrsta = zamjena stare, ničega = dodavanje. Optimistički — na grešku se
   * vrati snimak od prije.
   */
  async toggleReaction(item: BlogMediaItem, kind: string, event: Event) {
    event.stopPropagation();
    if (!this.currentUserId) return;

    const rows = this.reactionsByMedia.get(item.id) ?? [];
    const before = rows.map(r => ({ ...r }));
    const mine = rows.findIndex(r => r.profileId === this.currentUserId);
    const hadSame = mine >= 0 && rows[mine].kind === kind;

    if (mine >= 0) rows.splice(mine, 1);
    if (!hadSame) {
      rows.push({ mediaId: item.id, profileId: this.currentUserId, kind });
      this.fireBurst(event, kind);
    }
    this.reactionsByMedia.set(item.id, rows);
    this.closePalette();

    try {
      const outcome = await this.blogService.setReaction(item.id, this.currentUserId, kind);

      // Vlasniku objave stiže push — samo pri dodavanju/zamjeni (skidanje je
      // tiho) i nikad za sopstvenu objavu. Tiho na grešci (NotifyService).
      if (outcome !== 'removed' && item.ownerId && item.ownerId !== this.currentUserId) {
        const me = this.usernames.get(this.currentUserId) ?? 'Neko iz ekipe';
        void this.notify.sendToUser(
          item.ownerId,
          'Nova reakcija',
          `Reakcija od ${me}: ${kind}`,
          '/blog'
        );
      }
    } catch {
      // Vrati kako je bilo — bolje pošten korak nazad nego lažni balončić.
      this.reactionsByMedia.set(item.id, before);
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
      // Varijablu čita .lb (pozadina), ne okvir za klizanje!
      (strip.closest('.lb') as HTMLElement | null)?.style.setProperty(
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
        (strip.closest('.lb') as HTMLElement | null)?.style.setProperty('--lb-fade', '0');
      } else {
        strip.style.transform = 'translateX(-33.3333%)';
        (strip.closest('.lb') as HTMLElement | null)?.style.setProperty('--lb-fade', '1');
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
      this.kickVideo();
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
    this.videoPaused = false;
    this.videoMuted = false;
    this.videoProgress = 0;
    // Imerzivno: header i kupola kliznu VAN ekrana (CSS u njihovim
    // komponentama sluša ovu klasu) — sav ekran pripada snimku/slici.
    document.documentElement.classList.add('immersive');
  }

  closeLightbox() {
    this.selectedIndex = -1;
    this.pendingStep = 0;
    this.pendingClose = false;
    document.documentElement.classList.remove('immersive');
  }

  /**
   * Premještanje pregleda na <body>: `position: fixed` unutar skrol-kontejnera
   * se na iOS-u ponaša kao `absolute` (WebKit mana) — pregled je na telefonu
   * bio zarobljen ispod headera. Angular bindingi rade i na premještenom
   * čvoru, a *ngIf ga uredno skida ma gdje bio.
   */
  ngAfterViewChecked() {
    const el = this.lbRootRef?.nativeElement;
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
  }

  ngOnDestroy() {
    if (this.moveHandler) document.removeEventListener('touchmove', this.moveHandler);
    clearTimeout(this.paletteTimer);
    clearTimeout(this.burstTimer);
    clearTimeout(this.peekTimer);
    clearTimeout(this.composeCloseTimer);
    clearTimeout(this.confirmDeleteTimer);
    URL.revokeObjectURL(this.composeUrl);
    if (this.composeFile) this.floatLayer.close();
    // Napuštanje ekrana dok je pregled otvoren ne smije ostaviti aplikaciju
    // bez headera i menija.
    document.documentElement.classList.remove('immersive');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    // Kompozer umjesto slijepe objave: pregled + opis, pa tek „Objavi".
    this.uploadError = '';
    URL.revokeObjectURL(this.composeUrl);
    this.composeFile = file;
    this.composeUrl = URL.createObjectURL(file);
    this.composeIsVideo = file.type.startsWith('video/');
    this.composeCaption = '';
    this.composeClosing = false;
    this.composeDuration = 0;
    this.trimStart = 0;
    this.trimEnd = 0;
    this.floatLayer.open();
  }

  onComposeMeta(v: HTMLVideoElement) {
    this.composeDuration = isFinite(v.duration) ? v.duration : 0;
    this.trimStart = 0;
    this.trimEnd = this.composeDuration;
  }

  /** Reprodukcija u pregledu se vrti unutar izabranog raspona. */
  onComposeTime(v: HTMLVideoElement) {
    if (!this.composeDuration) return;
    if (v.currentTime >= this.trimEnd - 0.05 || v.currentTime < this.trimStart - 0.25) {
      v.currentTime = this.trimStart;
    }
  }

  onTrimDown(event: PointerEvent, track: HTMLElement) {
    if (!this.composeDuration) return;
    event.preventDefault();
    track.setPointerCapture?.(event.pointerId);

    const t = this.trimValueAt(event, track);
    // Bliža ručka se hvata — i drag odmah premotava pregled na nju.
    this.trimHandle =
      Math.abs(t - this.trimStart) <= Math.abs(t - this.trimEnd) ? 'l' : 'r';
    this.moveTrim(t);
  }

  onTrimMove(event: PointerEvent, track: HTMLElement) {
    if (!this.trimHandle) return;
    this.moveTrim(this.trimValueAt(event, track));
  }

  onTrimUp() { this.trimHandle = null; }

  private trimValueAt(event: PointerEvent, track: HTMLElement): number {
    const r = track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (event.clientX - r.left) / r.width));
    return f * this.composeDuration;
  }

  private moveTrim(t: number) {
    const MIN = 0.5;   // rez kraći od pola sekunde nema smisla
    const video = this.bcVideoRef?.nativeElement;
    if (this.trimHandle === 'l') {
      this.trimStart = Math.min(t, this.trimEnd - MIN);
      if (video) video.currentTime = this.trimStart;
    } else {
      this.trimEnd = Math.max(t, this.trimStart + MIN);
      if (video) video.currentTime = this.trimEnd;
    }
  }

  fmtT(t: number): string {
    const s = Math.max(0, Math.round(t));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  closeComposer() {
    if (!this.composeFile || this.composeClosing) return;
    this.composeClosing = true;
    clearTimeout(this.composeCloseTimer);
    this.composeCloseTimer = setTimeout(() => {
      URL.revokeObjectURL(this.composeUrl);
      this.composeFile = null;
      this.composeUrl = '';
      this.composeClosing = false;
      this.floatLayer.close();
    }, 280);
  }

  async publishCompose() {
    const file = this.composeFile;
    if (!file || this.uploading || this.compressing) return;

    const caption = this.composeCaption.trim() || null;
    // Trim se šalje samo ako je stvarno pomjeren (tolerancija za drhtaj ručke).
    const trim = this.composeIsVideo && this.composeDuration > 0
      && (this.trimStart > 0.05 || this.trimEnd < this.composeDuration - 0.05)
      ? { start: this.trimStart, end: this.trimEnd }
      : undefined;
    this.closeComposer();

    let toUpload = file;

    try {
      if (file.type.startsWith('image/')) {
        this.compressing = true;
        toUpload = await compressImage(file);
      } else if (file.type.startsWith('video/')) {
        this.compressing = true;
        this.compressProgress = 0;
        toUpload = await compressVideo(file, ratio => this.compressProgress = ratio, trim);
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
      await this.blogService.uploadMedia(toUpload, this.userId, caption);
      await this.loadMedia();
    } catch (err: any) {
      this.uploadError = err.message ?? 'Greška prilikom otpremanja fajla.';
    } finally {
      this.uploading = false;
    }
  }

  /** Dvostepeno brisanje — bez ružnog sistemskog confirm-a. */
  askDelete(item: BlogMediaItem, event: Event) {
    event.stopPropagation();

    if (this.confirmDeleteId !== item.id) {
      this.confirmDeleteId = item.id;
      clearTimeout(this.confirmDeleteTimer);
      this.confirmDeleteTimer = setTimeout(() => this.confirmDeleteId = null, 3000);
      return;
    }

    clearTimeout(this.confirmDeleteTimer);
    this.confirmDeleteId = null;
    void this.doDelete(item);
  }

  private async doDelete(item: BlogMediaItem) {
    if (this.deletingId) return;
    this.deletingId = item.id;

    try {
      await this.blogService.deleteMedia(item.id);
      this.mediaItems = this.mediaItems.filter(m => m.id !== item.id);
      this.reactionsByMedia.delete(item.id);
      this.buildGroups();
      if (this.selectedItem?.id === item.id) this.closeLightbox();
    } catch (err: any) {
      this.uploadError = err.message ?? 'Greška pri brisanju objave.';
    } finally {
      this.deletingId = null;
    }
  }
}
