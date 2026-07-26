import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  LeaderboardService, LeaderEntry, WeekMember, RecordEvent, PeriodDays, PERIODS
} from '../../services/leaderboard.service';
import { AuthService } from '../../services/auth.service';
import { ExerciceService } from '../../services/exercice.service';
import { humanError } from '../../shared/errors';
import {
  PickerGroup, PickerOption, toPickerGroups
} from '../shared/exercice-picker/exercice-picker.component';

/** Koliko se rekorda prikaže odjednom, i koliko ih doda „Učitaj još". */
const RECORDS_STEP = 8;

/**
 * Ekran „Ekipa".
 *
 * Ranije je ovdje bila samo rang lista po vježbi: `<select>` sa pedesetak
 * naziva, podijum i tabela. Problem nije bio izgled nego oblik — od 37 vježbi
 * samo tri imaju upise od više od jedne osobe, pa je ekran u većini slučajeva
 * prikazivao jednog čovjeka i dva prazna bloka.
 *
 * Zato su dodate dvije sekcije iznad rang liste, obje računate iz podataka koje
 * već imamo (nema nove tabele):
 *
 *   SEDMICA        ko je kog dana trenirao — jedina sekcija koja ima sadržaj
 *                  i za onoga ko još nije upisao nijednu seriju
 *   NOVI REKORDI   oborene kilaže u zadnje dvije sedmice — pretvara usamljeni
 *                  upis serije u nešto što ekipa vidi
 *
 * ANIMACIJE
 *
 * Sve ulazne animacije su CSS, sa `animation-delay` po indeksu reda. Ponovo se
 * puštaju pri promjeni vježbe ili perioda tako što `renderKey` uđe u `trackBy`:
 * čvorovi se tada ponovo naprave i animacija krene ispočetka. To je jedini
 * način da se animacija ponovi bez `@angular/animations`, koji projekat ne
 * koristi.
 */
@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {

  readonly periods = PERIODS;

  // --- Sedmica ---------------------------------------------------------------
  week: WeekMember[] = [];
  weekLoading = true;
  /** Skraćenice dana, ponedjeljak → nedjelja. */
  readonly dayLabels = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];
  todayIndex = 0;

  // --- Rekordi ---------------------------------------------------------------
  records: RecordEvent[] = [];
  recordsLoading = true;

  /**
   * Kad trenira samo jedna osoba, cio spisak je njen. Prekidač „moji" je zato
   * i jedino mjesto u aplikaciji gdje se vide sopstveni oboreni rekordi —
   * profil to još nema.
   */
  recordScope: 'all' | 'me' = 'all';
  /** Koliko ih je trenutno prikazano. Raste dugmetom, ne novim upitom. */
  recordsShown = RECORDS_STEP;
  recordsKey = 0;

  // --- Rang po vježbi --------------------------------------------------------
  pickerGroups: PickerGroup[] = [];
  showPicker = false;
  selectedExercice: PickerOption | null = null;
  selectedExerciceId = '';

  period: PeriodDays = 30;
  entries: LeaderEntry[] = [];
  loading = false;
  loadingExercices = true;

  errorMessage = '';
  currentUserId = '';

  /** Mijenja se pri svakoj promjeni izbora — vidi komentar o animacijama. */
  renderKey = 0;

  constructor(
    private leaderboardService: LeaderboardService,
    private exerciceService: ExerciceService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.currentUserId = this.authService.getCurrentUser()?.id ?? '';

    const js = new Date().getDay();
    this.todayIndex = js === 0 ? 6 : js - 1;

    // Nezavisni upiti — ne čekaju jedan drugog, pa se sekcije pojavljuju
    // čim koja bude spremna.
    void this.loadWeek();
    void this.loadRecords();

    try {
      const groups = await this.leaderboardService.getExerciceGroups();
      this.pickerGroups = toPickerGroups(groups.filter(g => g.exercices.length > 0));
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju vježbi.');
    } finally {
      this.loadingExercices = false;
    }

    // Iz treninga se dolazi sa ?exercice=...
    const preselected = this.route.snapshot.queryParamMap.get('exercice');
    if (preselected) {
      this.selectedExerciceId = preselected;
      this.selectedExercice = this.findOption(preselected);
      await this.loadBoard();
    }
  }

  // ---------------------------------------------------------------------------

  private async loadWeek() {
    try {
      this.week = await this.leaderboardService.getTeamWeek();
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju sedmice.');
    } finally {
      this.weekLoading = false;
    }
  }

  private async loadRecords() {
    try {
      this.records = await this.leaderboardService.getRecords();
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju rekorda.');
    } finally {
      this.recordsLoading = false;
    }
  }

  private async loadBoard() {
    this.entries = [];
    this.errorMessage = '';
    if (!this.selectedExerciceId) return;

    this.loading = true;

    try {
      this.entries = await this.leaderboardService.getLeaderboard(
        this.selectedExerciceId, this.period
      );
      this.renderKey++;
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju rang liste.');
    } finally {
      this.loading = false;
    }
  }

  setRecordScope(scope: 'all' | 'me') {
    if (this.recordScope === scope) return;
    this.recordScope = scope;
    this.recordsShown = RECORDS_STEP;   // novi opseg kreće od vrha
    this.recordsKey++;
  }

  showMoreRecords() {
    this.recordsShown += RECORDS_STEP;
  }

  /** Rekordi u izabranom opsegu, prije sječenja. */
  get scopedRecords(): RecordEvent[] {
    return this.recordScope === 'me'
      ? this.records.filter(r => r.userId === this.currentUserId)
      : this.records;
  }

  get visibleRecords(): RecordEvent[] {
    return this.scopedRecords.slice(0, this.recordsShown);
  }

  get moreRecords(): number {
    return Math.max(0, this.scopedRecords.length - this.recordsShown);
  }

  onPick(option: PickerOption) {
    this.showPicker = false;
    if (option.id === this.selectedExerciceId) return;

    this.selectedExercice = option;
    this.selectedExerciceId = option.id;
    void this.loadBoard();
  }

  setPeriod(days: PeriodDays) {
    if (this.period === days) return;
    this.period = days;
    void this.loadBoard();
  }

  // ---------------------------------------------------------------------------
  // Izvedeni prikazi

  /** Prva tri mjesta, i to samo ona koja stvarno imaju rezultat. */
  get podium(): LeaderEntry[] {
    return this.entries.filter(e => e.weight !== null).slice(0, 3);
  }

  /**
   * Raspored blokova: drugi, prvi, treći — kao na pravom podijumu.
   * Kad ima manje od tri rezultata, prikazuju se samo popunjena mjesta,
   * centrirana; prazna postolja izgledaju kao kvar.
   */
  get podiumOrder(): LeaderEntry[] {
    const p = this.podium;
    if (p.length === 3) return [p[1], p[0], p[2]];
    if (p.length === 2) return [p[1], p[0]];
    return p;
  }

  /** Ostatak liste ispod podijuma — svi, uključujući i one bez rezultata. */
  get hasResults(): boolean {
    return this.entries.some(e => e.weight !== null);
  }

  /** Visina postolja — prvo mjesto najviše, ostali srazmjerno. */
  blockHeight(entry: LeaderEntry): number {
    switch (entry.rank) {
      case 1:  return 100;
      case 2:  return 76;
      default: return 58;
    }
  }

  /** Dužina trake u listi, u odnosu na najbolji rezultat. */
  barWidth(entry: LeaderEntry): number {
    const best = this.podium[0]?.weight ?? 0;
    if (!best || entry.weight === null) return 0;
    return Math.max(8, Math.round((entry.weight / best) * 100));
  }

  /**
   * Koliko ti fali do prvog mjesta — jedini broj koji stvarno tjera na trening.
   *
   * Bez imena vodećeg: „za Ćofi" je pogrešan padež, a nadimci se ne mogu
   * pouzdano deklinirati. Prvo mjesto je ionako vidljivo iznad.
   *
   * Vraća `null` i kad si izjednačen na vrhu — tada je razlika 0, pa bi pisalo
   * „fali ti 0 kg", što je besmisleno.
   */
  get myGap(): { behind: number } | null {
    const leader = this.podium[0];
    const me = this.entries.find(e => e.userId === this.currentUserId);

    if (!leader || !me || me.weight === null) return null;
    if (me.rank === leader.rank) return null;

    return { behind: leader.weight! - me.weight };
  }

  get periodLabel(): string {
    return this.periods.find(p => p.days === this.period)?.label ?? '';
  }

  pictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
  }

  private findOption(id: string): PickerOption | null {
    for (const g of this.pickerGroups) {
      const hit = g.items.find(o => o.id === id);
      if (hit) return hit;
    }
    return null;
  }

  // `renderKey` u ključu tjera Angular da napravi nove čvorove, pa se CSS
  // animacija pusti ponovo pri svakoj promjeni vježbe ili perioda.
  trackEntry = (_: number, e: LeaderEntry) => `${this.renderKey}|${e.userId}`;
  trackMember = (_: number, m: WeekMember) => m.userId;
  trackRecord = (_: number, r: RecordEvent) =>
    `${this.recordsKey}|${r.userId}|${r.exerciceId}|${r.date}|${r.weight}`;
}
