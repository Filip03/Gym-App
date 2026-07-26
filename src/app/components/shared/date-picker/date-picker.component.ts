import {
  Component, EventEmitter, HostListener, Input, OnInit, Output
} from '@angular/core';

/**
 * Birač datuma.
 *
 * ZAŠTO NE `<input type="date">`
 *
 * Nativni birač se **ne može** stilizovati. CSS može da obuzda samo sam okvir
 * polja; kalendar koji se otvori na klik crta pregledač, po sistemskoj temi, i
 * nijedan selektor ga ne dohvata. Usred tamnog ekrana iskoči bijeli Chrome-ov
 * kalendar sa plavim dugmadima.
 *
 * Zato je ovdje sopstveni: ista mreža i isti tokeni kao kalendar treninga u
 * profilu, pa se dva kalendara u istoj aplikaciji ne razlikuju.
 *
 * Radi sa `YYYY-MM-DD` nizom, ne sa `Date`. Baza čuva `date` bez vremena, a
 * `Date` uvodi zonu i ljetnje računanje u nešto što je samo dan u mjesecu.
 */
@Component({
  selector: 'app-date-picker',
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss']
})
export class DatePickerComponent implements OnInit {

  /** Izabrani datum, `YYYY-MM-DD`. */
  @Input() value = '';
  @Input() title = 'Izaberi datum';
  /** Datumi poslije ovoga se ne mogu izabrati. Prazno = bez granice. */
  @Input() max = '';

  @Output() pick = new EventEmitter<string>();
  @Output() dismiss = new EventEmitter<void>();

  readonly weekLabels = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];

  cells: { iso: string; day: number; disabled: boolean }[] = [];
  lead = 0;
  title$ = '';

  private cursor = new Date();

  private readonly months = [
    'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
    'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
  ];

  ngOnInit() {
    // Otvara se na mjesecu izabranog datuma, ne uvijek na tekućem — inače se
    // pri ispravci starijeg upisa mora listati unazad svaki put.
    if (this.value) this.cursor = new Date(`${this.value}T12:00:00`);
    this.build();
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.dismiss.emit(); }

  prev() { this.shift(-1); }
  next() { this.shift(1); }

  private shift(by: number) {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + by, 1);
    this.build();
  }

  private build() {
    const year = this.cursor.getFullYear();
    const month = this.cursor.getMonth();

    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.lead = (first.getDay() + 6) % 7;   // sedmica počinje ponedjeljkom
    this.title$ = `${this.months[month]} ${year}`;

    this.cells = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = this.iso(new Date(year, month, day));
      this.cells.push({ iso, day, disabled: !!this.max && iso > this.max });
    }
  }

  choose(iso: string, disabled: boolean) {
    if (disabled) return;
    this.pick.emit(iso);
  }

  today() {
    const iso = this.iso(new Date());
    if (this.max && iso > this.max) return;
    this.pick.emit(iso);
  }

  get isToday(): (iso: string) => boolean {
    const t = this.iso(new Date());
    return iso => iso === t;
  }

  private iso(d: Date): string {
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  trackCell = (_: number, c: { iso: string }) => c.iso;
}

/** `2026-07-26` → `26.07.2026.` — za prikaz u polju koje otvara birač. */
export function formatIsoDate(iso: string): string {
  if (!iso || iso.length < 10) return '';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.`;
}
