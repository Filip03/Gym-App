import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { ExerciceService } from '../../../services/exercice.service';

/**
 * Detaljan pregled jedne vježbe — velika slika, mišićne grupe i opis bez
 * skraćivanja.
 *
 * Izdvojen iz taba Vježbe da bi ISTI popup (isti izgled, ista animacija)
 * koristio i editor plana: dodir na sličicu izabrane vježbe otvara ovaj
 * pregled umjesto nekog novog, trećeg prikaza.
 */

export interface ExerciceDetailData {
  name: string | null;
  picture: string | null;
  description: string | null;
}

@Component({
  selector: 'app-exercice-detail',
  templateUrl: './exercice-detail.component.html',
  styleUrls: ['./exercice-detail.component.scss']
})
export class ExerciceDetailComponent {

  @Input() exercice: ExerciceDetailData | null = null;
  /** Nazivi mišićnih grupa; prazan niz = red sa grupama se ne prikazuje. */
  @Input() groups: string[] = [];
  /** Izlazna animacija u toku (drži je servis) — zavjesa i kartica odlaze. */
  @Input() closing = false;

  @Output() dismiss = new EventEmitter<void>();

  constructor(private exerciceService: ExerciceService) {}

  /** Escape zatvara — popup je poklopio ekran, mora postojati izlaz s tastature. */
  @HostListener('document:keydown.escape')
  onEscape() { this.dismiss.emit(); }

  pictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
  }
}
