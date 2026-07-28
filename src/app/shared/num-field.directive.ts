import { Directive, ElementRef, HostListener, Input, OnInit, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Polje za unos broja — kilaža, ponavljanja, serije, visina.
 *
 * ZAŠTO NE `<input type="number">`
 *
 * Dvije stvari koje su smetale u teretani, obje sa telefona:
 *
 *   1. TASTATURA. `type="number"` na iPhoneu otvara punu tastaturu sa slovima,
 *      pa se za dvocifren broj prvo mora prebaciti na brojeve. `inputmode` to
 *      rješava, ali samo ako polje nije `type="number"` — tada ga pregledači
 *      ignorišu ili se ponašaju različito.
 *
 *   2. ZAREZ. Ovo je gore i tiho: `type="number"` ODBACUJE sve što ne umije da
 *      pročita kao broj, a zarez u to spada. Ko ima tastaturu čiji numerički
 *      raspored nudi zarez umjesto tačke — a to zavisi od regiona telefona —
 *      otkuca „85,5" i polje ostane PRAZNO, bez ijedne poruke. Izgleda kao da
 *      aplikacija ne prima unos.
 *
 * Zato je polje obično tekstualno, sa `inputmode` koji otvara pravu tastaturu,
 * a ova direktiva je `ControlValueAccessor` — dakle `[(ngModel)]` i dalje dobija
 * BROJ, pa se u komponentama ništa ne mijenja.
 *
 * Zarez i tačka su ravnopravni na ulazu. Prikaz ostaje sa tačkom, kako se broj
 * ispisuje i svuda drugdje u aplikaciji.
 *
 * Upotreba:
 *   <input appNumField />                    <!-- kilaža: dozvoljena decimala -->
 *   <input appNumField="integer" />          <!-- ponavljanja, serije -->
 */
@Directive({
  selector: 'input[appNumField]',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => NumFieldDirective),
    multi: true
  }]
})
export class NumFieldDirective implements ControlValueAccessor, OnInit {

  /** `integer` = samo cifre. Sve ostalo dozvoljava jednu decimalu. */
  @Input('appNumField') mode: '' | 'decimal' | 'integer' = 'decimal';

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private el: ElementRef<HTMLInputElement>) {}

  ngOnInit() {
    const el = this.el.nativeElement;
    // Postavlja se ovdje, a ne u šablonu, da se ne može zaboraviti na nekom polju.
    el.type = 'text';
    el.inputMode = this.isInteger ? 'numeric' : 'decimal';
    el.autocomplete = 'off';
  }

  private get isInteger(): boolean { return this.mode === 'integer'; }

  // --- ControlValueAccessor ---------------------------------------------------

  writeValue(value: unknown): void {
    this.el.nativeElement.value =
      (value === null || value === undefined || value === '') ? '' : String(value);
  }

  registerOnChange(fn: (value: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.el.nativeElement.disabled = isDisabled; }

  // --- Unos -------------------------------------------------------------------

  @HostListener('input')
  onInput(): void {
    const el = this.el.nativeElement;
    const cleaned = this.clean(el.value);

    // Sadržaj se prepisuje samo kad se stvarno promijenio — inače bi kursor
    // skakao na kraj pri svakom otkucanom znaku.
    if (cleaned !== el.value) {
      const removed = el.value.length - cleaned.length;
      const caret = Math.max(0, (el.selectionStart ?? cleaned.length) - removed);
      el.value = cleaned;
      try { el.setSelectionRange(caret, caret); } catch { /* neka polja ne daju kursor */ }
    }

    this.onChange(this.parse(cleaned));
  }

  @HostListener('blur')
  onBlur(): void { this.onTouched(); }

  /** Zadržava samo ono što može biti broj; zarez postaje tačka. */
  private clean(raw: string): string {
    let s = raw.replace(/,/g, '.');
    s = s.replace(this.isInteger ? /[^\d]/g : /[^\d.]/g, '');

    // Druga tačka se odbacuje — „85.5.2" nije broj, a lako se otkuca u žurbi.
    if (!this.isInteger) {
      const first = s.indexOf('.');
      if (first !== -1) {
        s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, '');
      }
    }
    return s;
  }

  /**
   * Prazno i samo „." daju `null`, a ne 0 — komponente razlikuju „nije upisano"
   * od „upisana nula" (npr. zgibovi bez tega su stvarno 0 kg).
   */
  private parse(s: string): number | null {
    if (s === '' || s === '.') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
}
