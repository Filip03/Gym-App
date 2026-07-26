import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { BlogService, BlogMediaItem } from '../../services/blog.service';
import { compressImage } from '../../shared/image-compress';
import { compressVideo } from '../../shared/video-compress';

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

  selectedItem: BlogMediaItem | null = null;

  constructor(
    private authService: AuthService,
    private blogService: BlogService
  ) {}

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Nisi ulogovan.';
      this.loading = false;
      return;
    }

    await this.loadMedia();
  }

  private async loadMedia() {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.mediaItems = await this.blogService.listMedia();
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju sadržaja.';
    } finally {
      this.loading = false;
    }
  }

  triggerUpload() {
    if (this.uploading || this.compressing) return;
    this.fileInputRef.nativeElement.click();
  }

  openLightbox(item: BlogMediaItem) {
    this.selectedItem = item;
  }

  closeLightbox() {
    this.selectedItem = null;
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
      await this.blogService.uploadMedia(toUpload);
      await this.loadMedia();
    } catch (err: any) {
      this.uploadError = err.message ?? 'Greška prilikom otpremanja fajla.';
    } finally {
      this.uploading = false;
    }
  }
}
