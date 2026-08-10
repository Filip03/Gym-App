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

  open(exercice: ExerciceDetailData, groups: string[] = []) {
    this.exercice = exercice;
    this.groups = groups;
  }

  close() {
    this.exercice = null;
    this.groups = [];
  }
}
