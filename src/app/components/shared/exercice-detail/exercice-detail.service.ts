import { Injectable } from '@angular/core';
import { ExerciceDetailData } from './exercice-detail.component';

/**
 * JEDAN globalni pregled vježbe za cijelu aplikaciju — komponenta živi u
 * ljusci (app.component), a otvara se odavde.
 *
 * Zašto u ljusci, a ne u stranici: preklopni sloj u toku stranice potone pod
 * futer čim mu bilo koji predak (animacija, transform) napravi svoj stacking
 * context — pa se kupola crtala PREKO kartice vježbe. Isti obrazac kao
 * ProfilePreviewService; ovo je kućna doktrina za sve preklopne slojeve
 * (docs/08-KONVENCIJE.md).
 */
@Injectable({ providedIn: 'root' })
export class ExerciceDetailService {

  exercice: ExerciceDetailData | null = null;
  groups: string[] = [];
  /**
   * Izlazna animacija u toku: element ostaje u DOM-u dok zavjesa i kartica
   * odsviraju odlazak (CSS ne svira animaciju na uklanjanju — kućno pravilo).
   */
  closing = false;
  private closeTimer: any = null;

  open(exercice: ExerciceDetailData, groups: string[] = []) {
    clearTimeout(this.closeTimer);
    this.closing = false;
    this.exercice = exercice;
    this.groups = groups;
  }

  close() {
    if (!this.exercice || this.closing) return;
    this.closing = true;
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.exercice = null;
      this.groups = [];
      this.closing = false;
    }, 300);
  }
}
