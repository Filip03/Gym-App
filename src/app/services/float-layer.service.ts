import { Injectable } from '@angular/core';

/**
 * Brojač otvorenih PLUTAJUĆIH slojeva — dio globalnog rješenja za „cut off"
 * klasu (vidi 08-KONVENCIJE i shared/portal.directive.ts).
 *
 * Dok je bar jedan plutajući sloj otvoren, ljuska drži `float-open` na
 * `.shell`, a futer se izdiže IZNAD zavjese sloja (z 340) — meni ostaje cio
 * i upotrebljiv ispod plutajuće kartice, umjesto da ga zavjesa proguta.
 *
 * Slojevi iz LJUSKE (pregled vježbe/profila) idu direktno kroz svoje
 * servise; ovaj brojač je za slojeve KOMPONENTI (rezime treninga...) da ne
 * moraju svaki put provlačiti novo stanje kroz app.component.
 */
@Injectable({ providedIn: 'root' })
export class FloatLayerService {

  private n = 0;

  get active(): boolean { return this.n > 0; }

  open(): void { this.n++; }

  close(): void { if (this.n > 0) this.n--; }
}
