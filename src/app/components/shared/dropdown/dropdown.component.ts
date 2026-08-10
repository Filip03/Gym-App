import {
  Component, ElementRef, EventEmitter, HostBinding, HostListener, Input,
  OnChanges, OnDestroy, Output, SimpleChanges
} from '@angular/core';

/**
 * Kućni padajući meni — zamjena za nativni `<select>`.
 *
 * ZAŠTO POSTOJI
 *
 * Nativni `<select>` na telefonu otvara sistemski točak koji ne liči ni na šta
 * u aplikaciji i ne može se animirati. Ovdje je to dugme koje izgleda kao
 * ostala polja, a otvara listu u kućnom jeziku pokreta: panel se razlije
 * (squash & stretch), kap mastila krene iz tačke dodira, opcije izranjaju
 * talasom. Zatvaranje je isto to unazad (`closing` stanje drži komponenta,
 * jer CSS ne svira animaciju na uklanjanju elementa).
 *
 * Tastatura: strelice šetaju po listi, Enter/Space bira, Escape zatvara —
 * fokus sve vrijeme ostaje na dugmetu (aria-activedescendant pokazuje gdje si).
 *
 * Upotreba:
 *   <app-dropdown [options]="tipovi" [value]="izabraniId" placeholder="Izaberi"
 *                 nullLabel="Bez tipa" (valueChange)="onPick($event)">
 */

export interface DropdownOption {
  id: string | null;
  name: string;
}

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.scss']
})
export class DropdownComponent implements OnChanges, OnDestroy {

  @Input() options: DropdownOption[] = [];
  @Input() value: string | null = null;
  @Input() placeholder = 'Izaberi';
  /** Natpis opcije „bez izbora" na vrhu liste. Prazan string = nema te opcije. */
  @Input() nullLabel = '';
  /** Osnova za id-jeve (label for, aria-activedescendant). */
  @Input() inputId = '';

  @Output() valueChange = new EventEmitter<string | null>();

  open = false;

  /**
   * Dok je lista otvorena, CIO host se izdiže iznad susjeda. Bez ovoga panel
   * (z-index unutar hosta) gubi od kasnijih elemenata u DOM-u koji animacijom
   * dobiju svoj stacking context — pa je „Dodaj prvu vježbu" hvatao dodire
   * preko otvorene liste (Markova prijava).
   */
  @HostBinding('class.open') get hostOpen() { return this.open; }
  @HostBinding('style.zIndex') get hostZ() { return this.open ? 60 : null; }
  @HostBinding('style.position') get hostPos() { return this.open ? 'relative' : null; }
  /** Kratko stanje za IZLAZNU animaciju panela. */
  closing = false;
  activeIndex = -1;
  /** Promjena ključa iznova rodi natpis na dugmetu, pa ulazni talas odsvira. */
  labelKey = 0;
  /** Kap mastila na dugmetu — iz tačke dodira, u procentima širine/visine. */
  ink: { x: number; y: number } | null = null;
  /** Kap na izabranoj opciji, u px unutar opcije. */
  chosenInk: { id: string | null; x: number; y: number } | null = null;

  private closeTimer: any = null;
  private chooseTimer: any = null;

  constructor(private host: ElementRef<HTMLElement>) {}

  get shown(): DropdownOption[] {
    return this.nullLabel
      ? [{ id: null, name: this.nullLabel }, ...this.options]
      : this.options;
  }

  get selectedName(): string {
    if (this.value == null) return '';
    return this.options.find(o => o.id === this.value)?.name ?? '';
  }

  ngOnChanges(changes: SimpleChanges) {
    // Vrijednost stigla spolja (i pri biranju — roditelj je vrati kroz [value]):
    // natpis se rađa iznova, pa promjena uleti talasom umjesto da preskoči.
    if (changes['value'] && !changes['value'].firstChange) this.labelKey++;
  }

  ngOnDestroy() {
    clearTimeout(this.closeTimer);
    clearTimeout(this.chooseTimer);
  }

  toggle(event: MouseEvent) {
    if (this.open) { this.startClose(); return; }

    // Kap kreće iz tačke dodira; na tastaturi (detail === 0) iz sredine.
    if (event.detail > 0) {
      const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
      if (r.width > 0) {
        this.ink = {
          x: ((event.clientX - r.left) / r.width) * 100,
          y: ((event.clientY - r.top) / r.height) * 100
        };
      }
    } else {
      this.ink = { x: 12, y: 50 };
    }

    this.openPanel();
  }

  private openPanel() {
    clearTimeout(this.closeTimer);
    this.closing = false;
    this.chosenInk = null;
    this.open = true;

    const idx = this.shown.findIndex(o => o.id === this.value);
    this.activeIndex = idx >= 0 ? idx : 0;
  }

  startClose() {
    if (!this.open) { return; }
    this.open = false;
    this.closing = true;
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.closing = false;
      this.chosenInk = null;
      this.ink = null;
    }, 300);
  }

  choose(option: DropdownOption, event?: MouseEvent) {
    // Kap iz tačke dodira na samoj opciji — vidi se ŠTA je izabrano.
    if (event && event.detail > 0) {
      const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.chosenInk = { id: option.id, x: event.clientX - r.left, y: event.clientY - r.top };
    } else {
      this.chosenInk = { id: option.id, x: 18, y: 18 };
    }

    if (option.id !== this.value) this.valueChange.emit(option.id);

    // Kap kratko odsvira, pa se panel sipne — izbor se ne smije zatvoriti
    // u istom kadru u kojem je dodirnut.
    clearTimeout(this.chooseTimer);
    this.chooseTimer = setTimeout(() => this.startClose(), 140);
  }

  onTriggerKey(event: KeyboardEvent) {
    const n = this.shown.length;

    if (!this.open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.ink = { x: 12, y: 50 };
        this.openPanel();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); this.activeIndex = Math.min(n - 1, this.activeIndex + 1); break;
      case 'ArrowUp':   event.preventDefault(); this.activeIndex = Math.max(0, this.activeIndex - 1); break;
      case 'Home':      event.preventDefault(); this.activeIndex = 0; break;
      case 'End':       event.preventDefault(); this.activeIndex = n - 1; break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const o = this.shown[this.activeIndex];
        if (o) this.choose(o);
        break;
      }
      case 'Escape': event.preventDefault(); this.startClose(); break;
      case 'Tab': this.startClose(); break;
    }
  }

  /** Dodir bilo gdje van menija ga zatvara — kao i svaki drugi popup. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
      this.startClose();
    }
  }

  optId(index: number): string | null {
    return this.inputId ? `${this.inputId}-opt-${index}` : null;
  }

  trackOpt = (_: number, o: DropdownOption) => o.id ?? '∅';
}
