import { AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';

/**
 * PORTAL — globalno rješenje za cijelu klasu „cut off" bugova.
 *
 * Svaki plutajući sloj (padajuća lista, paleta reakcija, pregled slike...)
 * koji živi U TOKU stranice prije ili kasnije strada od nekog pretka:
 * `overflow: hidden` ga isiječe, skrol-kontejner ga na iOS-u zarobi
 * (`fixed` se unutar `-webkit-overflow-scrolling` ponaša kao `absolute`),
 * a tuđi stacking context mu pojede z-index. Krpili smo to mjesto po
 * mjesto — dropdown drop-up, paleta na fixed, pregled na <body> — dok
 * Marko nije presudio: „na globalnom nivou, ne svaki put isti bug".
 *
 * Direktiva element FIZIČKI premjesti na <body> čim se rodi. Angular
 * bindinzi, eventi i *ngIf rade netaknuto (Angular drži referencu čvora,
 * ne mjesto u DOM-u); pri uništavanju view-a čvor se uredno skida.
 *
 * PRAVILO (docs/08-KONVENCIJE.md): svaki NOVI plutajući sloj dobija
 * `appPortal` + `position: fixed` + z iz zajedničke skale u _tokens.scss.
 * Sloj sam računa svoje koordinate (getBoundingClientRect okidača).
 *
 *   <div class="moj-sloj" appPortal [style.left.px]="x" [style.top.px]="y">
 */
@Directive({
  selector: '[appPortal]',
  standalone: true
})
export class PortalDirective implements AfterViewInit, OnDestroy {

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit() {
    document.body.appendChild(this.el.nativeElement);
  }

  ngOnDestroy() {
    // Angular će čvor skinuti i sam; remove() je osigurač da premješteni
    // element nikad ne ostane siroče na <body>.
    this.el.nativeElement.remove();
  }
}
