import {
  AfterViewInit, Component, ElementRef, EventEmitter, HostListener,
  Input, OnChanges, Output, SimpleChanges, ViewChild
} from '@angular/core';
import { ExerciceService, MuscleGroupWithExercices } from '../../../services/exercice.service';

/**
 * Jedinstven birač vježbe.
 *
 * ZAŠTO POSTOJI
 *
 * Vježba se bira na četiri mjesta, a svako je to radilo drukčije:
 *
 *   trening → „Dodaj vježbu"   grupisan katalog sa slikama i pretragom
 *   trening → „Zamijeni"       ravna lista alternativa, bez kataloga
 *   leaderboard                obični `<select>` sa `<optgroup>`
 *   profil → napredak          isti obični `<select>`
 *
 * Na telefonu je `<select>` sistemski točak sa pedesetak stavki bez slika —
 * vježba se traži naslijepo. Grupisani katalog iz treninga je bio jedini
 * upotrebljiv, pa je izdvojen ovdje i sada ga koriste sva četiri mjesta.
 *
 * Komponenta crta cijeli modal (pozadinu i karticu), pa je poziv svuda isti:
 *
 *   <app-exercice-picker *ngIf="showPicker" [title]="..." [groups]="..."
 *                        (pick)="..." (dismiss)="showPicker = false">
 *
 * DVA OPSEGA
 *
 * Kad je proslijeđen `suggested`, iznad pretrage se pojavi prekidač između
 * užeg izbora („Slične vježbe", „Za današnji dan") i cijelog kataloga. Bez
 * njega se prikazuje samo katalog. Uži izbor je prazan iznenađujuće često
 * (vježba bez upisane mišićne grupe), pa se u tom slučaju odmah otvara katalog
 * — prazan ekran sa prekidačem izgleda kao kvar.
 */

export interface PickerOption {
  id: string;
  name: string;
  picture: string | null;
}

export interface PickerGroup {
  name: string;
  items: PickerOption[];
}

/** Katalog iz `ExerciceService` → oblik koji birač očekuje. */
export function toPickerGroups(
  groups: MuscleGroupWithExercices[],
  exclude: ReadonlySet<string> = new Set()
): PickerGroup[] {
  return groups
    .map(g => ({
      name: g.name,
      items: g.exercices
        .filter(e => !exclude.has(e.id))
        .map(e => ({ id: e.id, name: e.name ?? '', picture: e.picture }))
    }))
    .filter(g => g.items.length > 0);
}

/** Jedinstven spisak iz grupa — ista vježba može biti u više mišićnih grupa. */
export function flattenGroups(groups: PickerGroup[]): PickerOption[] {
  const seen = new Set<string>();
  return groups.flatMap(g => g.items).filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

@Component({
  selector: 'app-exercice-picker',
  templateUrl: './exercice-picker.component.html',
  styleUrls: ['./exercice-picker.component.scss']
})
export class ExercicePickerComponent implements OnChanges, AfterViewInit {

  @ViewChild('search') searchRef?: ElementRef<HTMLInputElement>;

  @Input() title = 'Izaberi vježbu';
  @Input() note = '';

  /** Cijeli katalog, grupisan po mišićnim grupama. */
  @Input() groups: PickerGroup[] = [];

  /** Uži izbor. `null` = bez prekidača opsega. */
  @Input() suggested: PickerOption[] | null = null;
  @Input() suggestedLabel = 'Preporučeno';
  @Input() allLabel = 'Sve vježbe';

  /** Trenutno izabrana vježba — dobija oznaku u mreži. */
  @Input() selectedId: string | null = null;

  @Input() loading = false;
  /** Upis u toku — sprječava dvostruki izbor. */
  @Input() busy = false;

  @Output() pick = new EventEmitter<PickerOption>();
  @Output() dismiss = new EventEmitter<void>();

  scope: 'suggested' | 'all' = 'all';
  query = '';

  constructor(private exerciceService: ExerciceService) {}

  ngAfterViewInit() {
    // Fokus na pretragu samo tamo gdje postoji tastatura.
    //
    // Na telefonu bi autofokus odmah podigao sistemsku tastaturu i pokrio
    // upravo mrežu sa slikama zbog koje birač i postoji. Na računaru je
    // suprotno — kucanje odmah po otvaranju je očekivano.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) this.searchRef?.nativeElement.focus();
  }

  /** Escape zatvara — modal je poklopio ekran, mora postojati izlaz s tastature. */
  @HostListener('document:keydown.escape')
  onEscape() { this.dismiss.emit(); }

  ngOnChanges(changes: SimpleChanges) {
    // Uži izbor stiže asinhrono; opseg se bira tek kad se zna ima li šta u njemu.
    if (changes['suggested'] || changes['loading']) {
      if (this.loading) return;
      this.scope = this.suggested && this.suggested.length > 0 ? 'suggested' : 'all';
    }
  }

  setScope(scope: 'suggested' | 'all') { this.scope = scope; }

  /**
   * Ono što se stvarno crta — u oba opsega isti oblik, pa je i predložak jedan.
   * Uži izbor je jedna grupa bez naslova; katalog zadržava svoje grupe.
   */
  get shown(): PickerGroup[] {
    const q = this.query.trim().toLowerCase();
    const match = (o: PickerOption) => !q || o.name.toLowerCase().includes(q);

    if (this.scope === 'suggested' && this.suggested) {
      const items = this.suggested.filter(match);
      return items.length ? [{ name: '', items }] : [];
    }

    return this.groups
      .map(g => ({ name: g.name, items: g.items.filter(match) }))
      .filter(g => g.items.length > 0);
  }

  get resultCount(): number {
    return this.shown.reduce((n, g) => n + g.items.length, 0);
  }

  get emptyText(): string {
    if (this.query.trim()) return `Nema vježbe koja sadrži „${this.query.trim()}".`;
    if (this.scope === 'suggested') return 'Nema preporučenih vježbi — probaj „' + this.allLabel + '".';
    return 'Nema vježbi za prikaz.';
  }

  pictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
  }

  trackGroup = (_: number, g: PickerGroup) => g.name;
  trackOption = (_: number, o: PickerOption) => o.id;
}
