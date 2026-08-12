import {
  Component, ElementRef, EventEmitter, HostListener, Input, NgZone,
  OnDestroy, OnInit, Output, ViewChild
} from '@angular/core';
import { FloatLayerService } from '../../../services/float-layer.service';

/**
 * Kroper profilne slike — Markov zahtjev 12.08.2026: slika se do sada slala
 * „na slijepo", bez ikakve kontrole šta će stati u kružić. Sada: krug
 * pokazuje TAČNO ono što će biti profilna; prst PREVLAČI sliku, uštip (ili
 * točkić na mišu) ZUMIRA; „Sačuvaj" iscrta uokvireni kvadrat u 512×512 JPEG
 * i vrati ga pozivaocu kao Blob — u bazu ide isječak, ne original.
 *
 * IZVEDBA BEZ CD-a PO KADRU: pointer eventi se obrađuju van Angular zone i
 * transform se piše direktno u stil (isti obrazac kao klizanje pregleda na
 * blogu i fizika balona). Sloj ide kroz appPortal + float obrazac
 * (08-KONVENCIJE), a futer diže FloatLayerService.
 */
@Component({
  selector: 'app-avatar-crop',
  templateUrl: './avatar-crop.component.html',
  styleUrls: ['./avatar-crop.component.scss']
})
export class AvatarCropComponent implements OnInit, OnDestroy {

  @Input() file!: File;
  /** Isječak spreman za otpremu (512×512 JPEG). */
  @Output() done = new EventEmitter<Blob>();
  @Output() dismiss = new EventEmitter<void>();

  @ViewChild('stage') stageRef!: ElementRef<HTMLElement>;
  @ViewChild('img') imgRef!: ElementRef<HTMLImageElement>;

  imgUrl = '';
  ready = false;
  busy = false;
  /** Kratko stanje za izlaznu animaciju (kućno pravilo). */
  closing = false;
  private closeTimer: any = null;

  // Geometrija: skala i pomak CENTRA slike u odnosu na centar kruga.
  private scale = 1;
  private minScale = 1;
  private tx = 0;
  private ty = 0;
  private natW = 0;
  private natH = 0;

  /** Aktivni prsti — jedan vuče, dva štipaju. */
  private pointers = new Map<number, { x: number; y: number }>();
  private lastDist = 0;

  constructor(private zone: NgZone, private floatLayer: FloatLayerService) {}

  ngOnInit() {
    this.imgUrl = URL.createObjectURL(this.file);
    this.floatLayer.open();
  }

  ngOnDestroy() {
    URL.revokeObjectURL(this.imgUrl);
    clearTimeout(this.closeTimer);
    this.floatLayer.close();
  }

  onImgLoad() {
    const img = this.imgRef.nativeElement;
    this.natW = img.naturalWidth;
    this.natH = img.naturalHeight;

    // Početak: slika POKRIVA krug (cover) i centrirana je.
    const v = this.viewport();
    this.minScale = Math.max(v / this.natW, v / this.natH);
    this.scale = this.minScale;
    this.tx = 0;
    this.ty = 0;
    this.ready = true;
    this.apply();
  }

  private viewport(): number {
    return this.stageRef?.nativeElement.clientWidth || 300;
  }

  /** Slika nikad ne smije otkriti prazninu unutar kruga. */
  private clamp() {
    const v = this.viewport();
    const maxX = Math.max(0, (this.natW * this.scale - v) / 2);
    const maxY = Math.max(0, (this.natH * this.scale - v) / 2);
    this.tx = Math.min(maxX, Math.max(-maxX, this.tx));
    this.ty = Math.min(maxY, Math.max(-maxY, this.ty));
  }

  private apply() {
    const img = this.imgRef?.nativeElement;
    if (!img) return;
    img.style.transform =
      `translate(-50%, -50%) translate(${this.tx.toFixed(1)}px, ${this.ty.toFixed(1)}px) scale(${this.scale.toFixed(4)})`;
  }

  /** Zum oko date tačke pozornice — tačka pod prstom/kursorom ostaje pod njim. */
  private zoomAt(factor: number, px: number, py: number) {
    const next = Math.min(this.minScale * 4, Math.max(this.minScale, this.scale * factor));
    const real = next / this.scale;
    if (real === 1) return;
    const v = this.viewport();
    const cx = px - v / 2;
    const cy = py - v / 2;
    this.tx = cx - (cx - this.tx) * real;
    this.ty = cy - (cy - this.ty) * real;
    this.scale = next;
    this.clamp();
    this.apply();
  }

  onPointerDown(event: PointerEvent) {
    if (!this.ready) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.lastDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  onPointerMove(event: PointerEvent) {
    const prev = this.pointers.get(event.pointerId);
    if (!prev || !this.ready) return;

    this.zone.runOutsideAngular(() => {
      const cur = { x: event.clientX, y: event.clientY };

      if (this.pointers.size === 1) {
        this.tx += cur.x - prev.x;
        this.ty += cur.y - prev.y;
        this.clamp();
        this.apply();
      } else if (this.pointers.size === 2) {
        this.pointers.set(event.pointerId, cur);
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.lastDist > 0) {
          const rect = this.stageRef.nativeElement.getBoundingClientRect();
          this.zoomAt(dist / this.lastDist,
            (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
        }
        this.lastDist = dist;
        return;
      }

      this.pointers.set(event.pointerId, cur);
    });
  }

  onPointerEnd(event: PointerEvent) {
    this.pointers.delete(event.pointerId);
    this.lastDist = 0;
  }

  onWheel(event: WheelEvent) {
    if (!this.ready) return;
    event.preventDefault();
    const rect = this.stageRef.nativeElement.getBoundingClientRect();
    this.zoomAt(event.deltaY < 0 ? 1.08 : 1 / 1.08,
      event.clientX - rect.left, event.clientY - rect.top);
  }

  /** Uokvireni kvadrat → 512×512 JPEG. */
  confirm() {
    if (!this.ready || this.busy) return;
    this.busy = true;

    const v = this.viewport();
    const srcSize = v / this.scale;
    const srcX = this.natW / 2 - this.tx / this.scale - srcSize / 2;
    const srcY = this.natH / 2 - this.ty / this.scale - srcSize / 2;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.imgRef.nativeElement, srcX, srcY, srcSize, srcSize, 0, 0, 512, 512);

    canvas.toBlob(blob => {
      this.busy = false;
      if (blob) this.done.emit(blob);
      else this.dismiss.emit();
    }, 'image/jpeg', 0.9);
  }

  onDismiss() {
    if (this.closing) return;
    this.closing = true;
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.dismiss.emit(), 280);
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.onDismiss(); }
}
