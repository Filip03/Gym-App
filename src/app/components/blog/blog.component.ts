import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AudioService } from '../../services/audio.service';
import { BlogService, BlogMediaItem } from '../../services/blog.service';
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

@Component({
  selector: 'app-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

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
  previewUserId: string | null = null;

  private userId = '';

  constructor(
    private authService: AuthService,
    private audio: AudioService,
    private blogService: BlogService,
    private profileService: ProfileService
  ) {}

  get selectedItem(): BlogMediaItem | null {
    return this.selectedIndex >= 0 ? this.flat[this.selectedIndex] ?? null : null;
  }

  get total(): number { return this.flat.length; }

  openProfilePreview(userId: string) {
    this.previewUserId = userId;
  }

  closeProfilePreview() {
    this.previewUserId = null;
  }

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
      this.mediaItems = await this.blogService.listMedia();
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

  // Prevlačenje kroz objave na telefonu — isti prag i uslov kao u špilu dana.
  private touchX = 0;
  private touchY = 0;

  onTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    this.touchX = event.touches[0].clientX;
    this.touchY = event.touches[0].clientY;
  }

  onTouchEnd(event: TouchEvent) {
    const t = event.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - this.touchX;
    const dy = t.clientY - this.touchY;

    // Povlačenje NADOLJE zatvara — uobičajen pokret za pregled slike na
    // telefonu, i jedini izlaz koji ne traži pogađanje malog dugmeta u uglu.
    if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      this.closeLightbox();
      return;
    }

    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) this.next(); else this.prev();
  }

  openLightbox(item: BlogMediaItem) {
    this.selectedIndex = this.indexOf(item);
  }

  closeLightbox() {
    this.selectedIndex = -1;
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
