import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService, ProgressPoint, TrainingDay, WeightPoint } from '../../services/profile.service';
import { ExerciceService, MuscleGroupWithExercices } from '../../services/exercice.service';
import { Profile } from '../../models/models';
import {
  PickerGroup, PickerOption, toPickerGroups
} from '../shared/exercice-picker/exercice-picker.component';
import { formatIsoDate } from '../shared/date-picker/date-picker.component';

/** Jedno polje u kalendaru treninga. */
interface CalCell {
  iso: string;
  day: number;
  /** 0 = nije trenirano, 1–4 = jačina zelene po broju serija. */
  level: number;
  sets: number;
  today: boolean;
  future: boolean;
}

/** Jedan red u spisku upisa težine. */
interface WeightRow {
  date: string;
  label: string;
  weight: number;
  /** Razlika u odnosu na PRETHODNI upis. `null` za najstariji. */
  delta: number | null;
}

/** Tačka na grafikonu tjelesne težine (Filipova funkcija, zadržana pri spajanju). */
interface WeightChartPoint {
  x: number;
  y: number;
  weight: number;
  dateLabel: string;
}

/**
 * Opsezi za statistiku ispod kalendara — zadati u CIJELIM SEDMICAMA.
 *
 * Nisu 30 / 90 / 365 dana, jer se tada „sedmično" ne može tačno podijeliti:
 * u 30 dana stane 4,3 sedmice, pa djelilac postaje razlomak i broj se razvodni.
 * Ovako je djelilac tačno 1, 4, 13 ili 52 — koliko sedmica stvarno staje.
 *
 * Natpisi su zaokruženi na ono kako se o tome govori: 4 sedmice se u teretani
 * zovu mjesec, 13 sedmica tri mjeseca.
 */
const STAT_RANGES: { weeks: number; label: string }[] = [
  { weeks: 1,  label: 'Sedmica' },
  { weeks: 4,  label: 'Mjesec' },
  { weeks: 13, label: '3 mjeseca' },
  { weeks: 52, label: 'Godina' }
];

const MONTHS = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
];

interface ChartPoint {
  x: number;
  y: number;
  weight: number;
  reps: number;
  dateLabel: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  loading = true;
  errorMessage = '';

  profile: Profile | null = null;
  email = '';
  avatarUrl: string | null = null;

  uploading = false;
  uploadError = '';

  editing = false;
  saving = false;
  saveError = '';
  editUsername = '';
  editHeight: number | null = null;
  editWeight: number | null = null;

  // --- Kalendar treninga ------------------------------------------------------
  //
  // Ne traži novu tabelu: `workout_sessions` postoji otkad je dodato dugme
  // „Trening gotov". Cijela godina se povlači jednom, pa je listanje mjeseci
  // trenutno i bez ijednog novog upita.
  calLoading = true;
  calDays: TrainingDay[] = [];
  calCells: CalCell[] = [];
  calLead = 0;                       // prazna polja prije prvog u mjesecu
  calTitle = '';
  calAtCurrentMonth = true;
  // Statistika ispod kalendara. Sve osim niza sedmica prati izabrani opseg.
  readonly statRanges = STAT_RANGES;
  /** Izabrani opseg, u sedmicama. */
  statRange = 4;

  rangeCount = 0;      // dana sa treningom
  rangeSets = 0;       // upisanih serija
  rangeAvg = '—';      // prosjek po punoj sedmici
  rangePerDay = '—';   // serija po treningu
  rangeBestDay = 0;    // najviše serija u jednom danu
  weekStreak = 0;      // trenutni niz — jedini koji NE zavisi od opsega

  /** Dana sa treningom u prikazanom mjesecu (prati strelice, ne opseg). */
  monthCount = 0;
  readonly weekLabels = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];
  private calCursor = new Date();

  // --- Tjelesna težina --------------------------------------------------------
  //
  // Filipova funkcija sa `main` grane, zadržana pri spajanju. `profiles.weight`
  // i dalje drži trenutnu vrijednost, a `weight_logs` istoriju — vidi migraciju
  // `20260726010000_weight_logs.sql`.
  showWeightModal = false;
  weightLoading = false;
  weightError = '';
  weightHistory: WeightPoint[] = [];
  loggingWeight = false;
  logWeightError = '';
  newWeightDate = this.iso(new Date());
  showDatePicker = false;
  newWeightValue: number | null = null;
  weightChartPoints: WeightChartPoint[] = [];
  weightChartLinePoints = '';
  weightAreaPath = '';
  weightYGridLines: { y: number; label: string }[] = [];
  weightXAxisLabels: { x: number; label: string }[] = [];
  weightChartWidth = 400;
  /** Spisak upisa, najnoviji prvi. */
  weightRows: WeightRow[] = [];

  exerciceGroups: MuscleGroupWithExercices[] = [];
  loadingExerciceGroups = true;
  selectedExerciceId = '';

  // Birač vježbe — isti kao u treningu, umjesto sistemskog <select>.
  pickerGroups: PickerGroup[] = [];
  showPicker = false;
  selectedExercice: PickerOption | null = null;

  otherProfiles: { id: string; username: string }[] = [];
  compareUserId = '';
  showComparePicker = false;
  compareUsername = '';
  private compareAllPoints: ProgressPoint[] = [];

  progressLoading = false;
  progressError = '';
  allProgressPoints: ProgressPoint[] = [];
  availableSetNumbers: number[] = [];
  selectedSetNumber: number | null = null;
  chartPoints: ChartPoint[] = [];
  chartLinePoints = '';
  areaPath = '';
  comparePoints: ChartPoint[] = [];
  compareLinePoints = '';
  compareAreaPath = '';
  yGridLines: { y: number; label: string }[] = [];
  xAxisLabels: { x: number; label: string }[] = [];
  chartWidth = 400;

  readonly chartHeight = 260;
  // Lijevo mora stati najduža oznaka ose („102.5 kg" = 8 znakova monospace-a),
  // a crta se od `chartPaddingLeft - 8` unalijevo. Sa 46 je ispadalo „l2.5 kg".
  readonly chartPaddingLeft = 62;
  // Desno: posljednja tačka nosi centriranu oznaku vrijednosti iznad sebe, pa
  // joj treba pola širine natpisa da ne bude odsječena.
  readonly chartPaddingRight = 34;
  readonly chartPaddingTop = 30;
  readonly chartPaddingBottom = 34;
  private readonly pointSpacing = 70;

  constructor(
    private authService: AuthService,
    private profileService: ProfileService,
    private exerciceService: ExerciceService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Nisi ulogovan.';
      this.loading = false;
      return;
    }

    this.email = user.email ?? '';

    void this.loadCalendar(user.id);   // ne čeka profil, puni se paralelno

    try {
      this.profile = await this.profileService.getProfile(user.id);
      this.updateAvatarUrl();
      void this.loadWeightHistory();
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju profila.';
    } finally {
      this.loading = false;
    }

    try {
      const groups = await this.exerciceService.getExercicesGroupedByMuscleGroup();
      this.exerciceGroups = groups.filter(g => g.exercices.length > 0);
      this.pickerGroups = toPickerGroups(this.exerciceGroups);
    } catch (err: any) {
      this.progressError = err.message ?? 'Greška pri učitavanju vježbi.';
    } finally {
      this.loadingExerciceGroups = false;
    }

    try {
      this.otherProfiles = await this.profileService.getOtherProfiles(user.id);
    } catch {
      // Poređenje sa drugim korisnicima jednostavno neće biti ponuđeno
    }

    // Iz treninga se dolazi sa ?exercice=..., pa se izbor podešava unaprijed.
    const preselectedExerciceId = this.route.snapshot.queryParamMap.get('exercice');
    if (preselectedExerciceId) {
      this.selectedExerciceId = preselectedExerciceId;
      this.selectedExercice = this.findOption(preselectedExerciceId);
      await this.onProgressExerciceChange();
    }
  }

  // ---------------------------------------------------------------------------
  // Tjelesna težina

  openWeightModal() { this.showWeightModal = true; }
  closeWeightModal() { this.showWeightModal = false; }

  async loadWeightHistory() {
    if (!this.profile) return;

    this.weightLoading = true;
    this.weightError = '';

    try {
      this.weightHistory = await this.profileService.getWeightHistory(this.profile.id);
      this.buildWeightChart();
      this.buildWeightRows();
    } catch (err: any) {
      this.weightError = err.message ?? 'Greška pri učitavanju težine.';
    } finally {
      this.weightLoading = false;
    }
  }

  async submitWeightLog() {
    if (!this.profile || this.loggingWeight) return;

    if (!this.newWeightDate || !this.newWeightValue || this.newWeightValue <= 0) {
      this.logWeightError = 'Unesi datum i validnu težinu.';
      return;
    }

    this.loggingWeight = true;
    this.logWeightError = '';

    try {
      this.profile = await this.profileService.logWeight(
        this.profile.id, this.newWeightDate, this.newWeightValue
      );
      this.newWeightValue = null;
      await this.loadWeightHistory();
    } catch (err: any) {
      this.logWeightError = err.message ?? 'Greška prilikom upisa težine.';
    } finally {
      this.loggingWeight = false;
    }
  }

  /** Spisak upisa sa razlikom u odnosu na prethodni. Najnoviji prvi. */
  private buildWeightRows() {
    this.weightRows = this.weightHistory
      .map((p, i) => ({
        date: p.date,
        label: this.formatDateLabel(p.date),
        weight: p.weight,
        delta: i === 0 ? null : +(p.weight - this.weightHistory[i - 1].weight).toFixed(1)
      }))
      .reverse();
  }

  /** Posljednja upisana težina. */
  get weightCurrent(): number | null {
    return this.weightHistory.length
      ? this.weightHistory[this.weightHistory.length - 1].weight
      : null;
  }

  /** Ukupna promjena od prvog upisa do danas. */
  get weightTotalChange(): number | null {
    if (this.weightHistory.length < 2) return null;
    const first = this.weightHistory[0].weight;
    const last = this.weightHistory[this.weightHistory.length - 1].weight;
    return +(last - first).toFixed(1);
  }

  /** „+1,2" / „−0,8" — minus je pravi minus (U+2212), ne crtica. */
  formatDelta(value: number): string {
    const s = Math.abs(value).toFixed(1).replace('.', ',');
    if (value > 0) return `+${s}`;
    if (value < 0) return `−${s}`;
    return '0,0';
  }

  /** Prikaz izabranog datuma u polju koje otvara birač. */
  get weightDateLabel(): string { return formatIsoDate(this.newWeightDate); }

  /** Gornja granica u biraču — težina se ne mjeri unaprijed. */
  get todayIso(): string { return this.iso(new Date()); }

  onDatePick(iso: string) {
    this.newWeightDate = iso;
    this.showDatePicker = false;
  }

  trackWeightRow = (_: number, r: WeightRow) => r.date;

  private buildWeightChart() {
    this.weightChartPoints = [];
    this.weightChartLinePoints = '';
    this.weightAreaPath = '';
    this.weightYGridLines = [];
    this.weightXAxisLabels = [];

    if (this.weightHistory.length === 0) return;

    this.weightChartWidth = this.chartPaddingLeft + this.chartPaddingRight
      + Math.max(1, this.weightHistory.length - 1) * this.pointSpacing;

    const weights = this.weightHistory.map(p => p.weight);
    let minWeight = Math.min(...weights);
    let maxWeight = Math.max(...weights);

    // Tjelesna težina se mijenja u uskom rasponu; bez ovog razmaka bi grafikon
    // od 73 do 74 kg izgledao kao vertikalni skok.
    if (minWeight === maxWeight) {
      const pad = Math.max(minWeight * 0.1, 0.5);
      minWeight -= pad;
      maxWeight += pad;
    } else {
      const pad = (maxWeight - minWeight) * 0.15;
      minWeight -= pad;
      maxWeight += pad;
    }
    minWeight = Math.max(0, minWeight);

    const step = this.computeNiceStep(maxWeight - minWeight);
    minWeight = Math.floor(minWeight / step) * step;
    maxWeight = Math.ceil(maxWeight / step) * step;
    if (maxWeight === minWeight) maxWeight += step;

    const innerWidth = this.weightChartWidth - this.chartPaddingLeft - this.chartPaddingRight;
    const innerHeight = this.chartHeight - this.chartPaddingTop - this.chartPaddingBottom;
    const xStep = this.weightHistory.length > 1 ? innerWidth / (this.weightHistory.length - 1) : 0;

    const xForIndex = (i: number) => this.chartPaddingLeft
      + (this.weightHistory.length > 1 ? i * xStep : innerWidth / 2);
    const yForWeight = (weight: number) => this.chartPaddingTop + innerHeight
      - ((weight - minWeight) / (maxWeight - minWeight)) * innerHeight;

    this.weightChartPoints = this.weightHistory.map((p, i) => ({
      x: xForIndex(i),
      y: yForWeight(p.weight),
      weight: p.weight,
      dateLabel: this.formatDateLabel(p.date)
    }));

    this.weightChartLinePoints = this.weightChartPoints.map(p => `${p.x},${p.y}`).join(' ');
    this.weightAreaPath = this.buildAreaPath(
      this.weightChartPoints, this.chartHeight - this.chartPaddingBottom
    );

    const tickCount = Math.round((maxWeight - minWeight) / step);
    for (let i = 0; i <= tickCount; i++) {
      const value = minWeight + i * step;
      const y = this.chartPaddingTop + innerHeight - (i / tickCount) * innerHeight;
      const label = Number.isInteger(value) ? value.toString() : value.toFixed(1);
      this.weightYGridLines.push({ y, label: `${label} kg` });
    }

    this.weightXAxisLabels = this.weightHistory.map((p, i) => ({
      x: xForIndex(i), label: this.formatDateLabel(p.date)
    }));
  }

  // ---------------------------------------------------------------------------
  // Kalendar treninga

  private async loadCalendar(userId: string) {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    try {
      this.calDays = await this.profileService.getTrainingCalendar(userId, this.iso(since));
      this.weekStreak = this.computeWeekStreak();
      this.computeRangeStats();
      this.buildMonth();
    } catch {
      // Kalendar je dodatak; greška ovdje ne smije oboriti ostatak profila.
      this.calDays = [];
    } finally {
      this.calLoading = false;
    }
  }

  setStatRange(weeks: number) {
    if (this.statRange === weeks) return;
    this.statRange = weeks;
    this.computeRangeStats();
  }

  get statRangeIndex(): number {
    return Math.max(0, this.statRanges.findIndex(r => r.weeks === this.statRange));
  }

  /**
   * Sve brojke za izabrani opseg, iz već učitanih dana — bez novog upita.
   *
   * Opseg je klizni prozor unazad od danas, u cijelim sedmicama, ne kalendarski
   * mjesec. Kalendarski mjesec ima svoju brojku („ovog mjeseca") koja prati
   * strelice iznad mreže.
   */
  private computeRangeStats() {
    const from = new Date();
    from.setDate(from.getDate() - this.statRange * 7);
    const fromIso = this.iso(from);

    const days = this.calDays.filter(d => d.date >= fromIso);

    this.rangeCount = days.length;
    this.rangeSets = days.reduce((n, d) => n + d.sets, 0);
    this.rangeBestDay = days.reduce((m, d) => Math.max(m, d.sets), 0);

    this.rangePerDay = this.rangeCount
      ? (this.rangeSets / this.rangeCount).toFixed(1).replace('.', ',')
      : '—';

    this.rangeAvg = this.computeWeekAvg(this.rangeCount, this.statRange);
  }

  prevMonth() { this.shiftMonth(-1); }
  nextMonth() { if (!this.calAtCurrentMonth) this.shiftMonth(1); }

  private shiftMonth(by: number) {
    this.calCursor = new Date(
      this.calCursor.getFullYear(), this.calCursor.getMonth() + by, 1
    );
    this.buildMonth();
  }

  /**
   * Sastavlja mrežu za mjesec na koji pokazuje `calCursor`.
   *
   * Sedmica počinje ponedjeljkom, pa se `getDay()` (0 = nedjelja) pomjera.
   * Prazna polja prije prvog u mjesecu nose samo razmak, nisu dani.
   */
  private buildMonth() {
    const year = this.calCursor.getFullYear();
    const month = this.calCursor.getMonth();

    const setsByDate = new Map(this.calDays.map(d => [d.date, d.sets]));
    const todayIso = this.iso(new Date());

    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.calLead = (first.getDay() + 6) % 7;
    this.calTitle = `${MONTHS[month]} ${year}`;

    const now = new Date();
    this.calAtCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    this.calCells = [];
    let inMonth = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = this.iso(new Date(year, month, day));
      const sets = setsByDate.get(iso);
      const trained = sets !== undefined;
      if (trained) inMonth++;

      this.calCells.push({
        iso,
        day,
        sets: sets ?? 0,
        // Nula serija znači „bio u teretani, ali ništa nije upisano" — to je i
        // dalje odrađen dan, pa dobija najsvjetliji nivo, ne prazno polje.
        level: trained ? 1 + Math.min(3, Math.floor((sets ?? 0) / 8)) : 0,
        today: iso === todayIso,
        future: iso > todayIso
      });
    }

    this.monthCount = inMonth;
  }

  /**
   * Uzastopne sedmice sa bar jednim treningom.
   *
   * Niz po DANIMA nema smisla u teretani — svaki dan odmora bi ga prekinuo, pa
   * bi skoro uvijek pisalo 1. Sedmica je jedinica koja stvarno mjeri da li se
   * održava ritam.
   *
   * Tekuća sedmica se ne računa kao prekid ako u njoj još nema treninga: tek je
   * počela, pa bi nuliranje niza u ponedjeljak ujutro bilo kažnjavanje ni za šta.
   */
  private computeWeekStreak(): number {
    if (this.calDays.length === 0) return 0;

    const weeks = new Set(this.calDays.map(d => this.mondayIso(new Date(`${d.date}T12:00:00`))));

    const cursor = new Date();
    let key = this.mondayIso(cursor);
    let streak = 0;

    if (!weeks.has(key)) {
      cursor.setDate(cursor.getDate() - 7);   // tekuća sedmica još ne broji
      key = this.mondayIso(cursor);
    }

    while (weeks.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
      key = this.mondayIso(cursor);
    }

    return streak;
  }

  /**
   * Prosjek treninga po sedmici, unutar izabranog opsega.
   *
   *     broj treninga u opsegu ÷ broj sedmica u opsegu
   *
   * Djelilac je **broj sedmica koje staju u opseg** — 1, 4, 13 ili 52. Pošto su
   * opsezi zadati u cijelim sedmicama, dijeljenje je tačno, bez razlomka.
   *
   * ČETIRI RANIJE VERZIJE, SVE POGREŠNE NA ISTI NAČIN — dijelile su nečim
   * drugim umjesto dužinom opsega:
   *
   *   1. `(danas − prvi trening) / 7`. Dva treninga u ponedjeljak i utorak →
   *      2 ÷ 0,29 sedmica = **7,0**. Projekcija, ne mjerenje.
   *   2. „Samo pune sedmice" — riješilo 7,0, ali je „7 dana" znalo pokazati
   *      0 treninga i prosjek 2,0 istovremeno, jer su brojač i prosjek gledali
   *      različite prozore.
   *   3. Djelilac ograničen na dužinu istorije. Šest treninga u jednoj sedmici
   *      uz opseg „30 dana" davalo je **6,0**, iako je to 1,5 sedmično.
   *   4. Djelilac `30 / 7 = 4,3`. Tačnije, ali se u 30 dana ne uklapa cio broj
   *      sedmica, pa je i sam opseg bio nezgodno definisan. Zato su opsezi sada
   *      cijele sedmice.
   *
   * Ko aplikaciju koristi tek sedmicu dana, uz opseg „Godina" vidjeće mali broj.
   * To je tačno — mjere se **upisani** treninzi, a za skorašnji ritam postoje
   * kraći opsezi.
   */
  private computeWeekAvg(count: number, weeks: number): string {
    if (weeks <= 0) return '—';
    return (count / weeks).toFixed(1).replace('.', ',');
  }

  private mondayIso(d: Date): string {
    const m = new Date(d);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return this.iso(m);
  }

  /** Lokalni datum kao `YYYY-MM-DD`. `toISOString()` uveče vraća sjutrašnji dan. */
  iso(d: Date): string {
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  trackCell = (_: number, c: CalCell) => c.iso;

  get compareLabel(): string {
    if (!this.compareUserId) return 'Niko';
    return this.otherProfiles.find(p => p.id === this.compareUserId)?.username ?? 'Niko';
  }

  chooseCompare(id: string) {
    this.showComparePicker = false;
    if (this.compareUserId === id) return;
    this.compareUserId = id;
    void this.onCompareUserChange();
  }

  onPick(option: PickerOption) {
    this.showPicker = false;
    if (option.id === this.selectedExerciceId) return;

    this.selectedExercice = option;
    this.selectedExerciceId = option.id;
    void this.onProgressExerciceChange();
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

  async onProgressExerciceChange() {
    this.progressError = '';
    this.allProgressPoints = [];
    this.availableSetNumbers = [];
    this.selectedSetNumber = null;
    this.compareUserId = '';
    this.compareUsername = '';
    this.compareAllPoints = [];
    this.resetChart();

    if (!this.selectedExerciceId || !this.profile) return;

    this.progressLoading = true;

    try {
      this.allProgressPoints = await this.profileService.getProgress(this.profile.id, this.selectedExerciceId);
      this.availableSetNumbers = [...new Set(this.allProgressPoints.map(p => p.set_number))].sort((a, b) => a - b);
      this.selectedSetNumber = this.availableSetNumbers[0] ?? null;
      this.applySetFilter();
    } catch (err: any) {
      this.progressError = err.message ?? 'Greška pri učitavanju progresa.';
    } finally {
      this.progressLoading = false;
    }
  }

  async onCompareUserChange() {
    this.compareAllPoints = [];
    this.compareUsername = this.otherProfiles.find(p => p.id === this.compareUserId)?.username ?? '';

    if (!this.compareUserId || !this.selectedExerciceId) {
      this.applySetFilter();
      return;
    }

    this.progressLoading = true;

    try {
      this.compareAllPoints = await this.profileService.getProgress(this.compareUserId, this.selectedExerciceId);
      this.applySetFilter();
    } catch (err: any) {
      this.progressError = err.message ?? 'Greška pri učitavanju poređenja.';
    } finally {
      this.progressLoading = false;
    }
  }

  selectSet(setNumber: number) {
    this.selectedSetNumber = setNumber;
    this.applySetFilter();
  }

  private applySetFilter() {
    const mine = this.selectedSetNumber === null
      ? []
      : this.allProgressPoints.filter(p => p.set_number === this.selectedSetNumber);

    const theirs = this.selectedSetNumber === null || !this.compareUserId
      ? []
      : this.compareAllPoints.filter(p => p.set_number === this.selectedSetNumber);

    this.buildChart(mine, theirs);
  }

  private resetChart() {
    this.chartPoints = [];
    this.chartLinePoints = '';
    this.areaPath = '';
    this.comparePoints = [];
    this.compareLinePoints = '';
    this.compareAreaPath = '';
    this.yGridLines = [];
    this.xAxisLabels = [];
  }

  private buildChart(myPoints: ProgressPoint[], theirPoints: ProgressPoint[]) {
    const unionDates = [...new Set([...myPoints.map(p => p.date), ...theirPoints.map(p => p.date)])].sort();

    if (unionDates.length === 0) {
      this.resetChart();
      return;
    }

    this.chartWidth = this.chartPaddingLeft + this.chartPaddingRight
      + Math.max(1, unionDates.length - 1) * this.pointSpacing;

    const allWeights = [...myPoints, ...theirPoints].map(p => p.weight);
    let minWeight = Math.min(...allWeights);
    let maxWeight = Math.max(...allWeights);

    if (minWeight === maxWeight) {
      const pad = Math.max(minWeight * 0.1, 0.5);
      minWeight -= pad;
      maxWeight += pad;
    } else {
      const pad = (maxWeight - minWeight) * 0.15;
      minWeight -= pad;
      maxWeight += pad;
    }
    minWeight = Math.max(0, minWeight);

    // Poravnaj opseg na "lep" korak (multiplikator od 2.5kg) da Y osa ne ispisuje čudne decimale
    const step = this.computeNiceStep(maxWeight - minWeight);
    minWeight = Math.floor(minWeight / step) * step;
    maxWeight = Math.ceil(maxWeight / step) * step;
    if (maxWeight === minWeight) {
      maxWeight += step;
    }

    const innerWidth = this.chartWidth - this.chartPaddingLeft - this.chartPaddingRight;
    const innerHeight = this.chartHeight - this.chartPaddingTop - this.chartPaddingBottom;
    const xStep = unionDates.length > 1 ? innerWidth / (unionDates.length - 1) : 0;

    const dateIndex = new Map<string, number>();
    unionDates.forEach((d, i) => dateIndex.set(d, i));

    const xForDate = (date: string) => this.chartPaddingLeft
      + (unionDates.length > 1 ? dateIndex.get(date)! * xStep : innerWidth / 2);
    const yForWeight = (weight: number) => this.chartPaddingTop + innerHeight
      - ((weight - minWeight) / (maxWeight - minWeight)) * innerHeight;

    const toChartPoints = (points: ProgressPoint[]): ChartPoint[] => points.map(p => ({
      x: xForDate(p.date),
      y: yForWeight(p.weight),
      weight: p.weight,
      reps: p.reps,
      dateLabel: this.formatDateLabel(p.date)
    }));

    this.chartPoints = toChartPoints(myPoints);
    this.comparePoints = toChartPoints(theirPoints);

    this.chartLinePoints = this.chartPoints.map(p => `${p.x},${p.y}`).join(' ');
    this.compareLinePoints = this.comparePoints.map(p => `${p.x},${p.y}`).join(' ');

    const baselineY = this.chartHeight - this.chartPaddingBottom;
    this.areaPath = this.buildAreaPath(this.chartPoints, baselineY);
    this.compareAreaPath = this.buildAreaPath(this.comparePoints, baselineY);

    const tickCount = Math.round((maxWeight - minWeight) / step);
    this.yGridLines = [];
    for (let i = 0; i <= tickCount; i++) {
      const value = minWeight + i * step;
      const y = this.chartPaddingTop + innerHeight - (i / tickCount) * innerHeight;
      const label = Number.isInteger(value) ? value.toString() : value.toFixed(1);
      this.yGridLines.push({ y, label: `${label} kg` });
    }

    this.xAxisLabels = unionDates.map(d => ({ x: xForDate(d), label: this.formatDateLabel(d) }));
  }

  // Bira "lep" korak (multiplikator od 2.5kg - standardni tegovi) tako da stane ~4-5 gridlines
  private computeNiceStep(range: number): number {
    const niceSteps = [2.5, 5, 10, 20, 25, 50, 100, 250, 500];
    const maxTicks = 5;

    for (const step of niceSteps) {
      if (range / step <= maxTicks) return step;
    }

    return Math.ceil(range / maxTicks / 500) * 500;
  }

  // Traži samo koordinate, pa prima i tačke grafikona vježbe i tačke težine.
  private buildAreaPath(points: { x: number; y: number }[], baselineY: number): string {
    if (points.length === 0) return '';

    const first = points[0];
    const last = points[points.length - 1];
    const linePart = points.map(p => `${p.x},${p.y}`).join(' L ');
    return `M ${first.x},${baselineY} L ${linePart} L ${last.x},${baselineY} Z`;
  }

  private formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
  }

  private updateAvatarUrl() {
    if (!this.profile?.profile_pic_url) {
      this.avatarUrl = null;
      return;
    }

    const publicUrl = this.profileService.getPublicUrl(this.profile.profile_pic_url);
    this.avatarUrl = `${publicUrl}?v=${Date.now()}`;
  }

  onAvatarClick() {
    if (this.uploading) return;
    this.fileInputRef.nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || !this.profile) return;

    this.uploading = true;
    this.uploadError = '';

    try {
      const path = await this.profileService.uploadProfilePicture(this.profile.id, file);
      this.profile.profile_pic_url = path;
      this.updateAvatarUrl();
    } catch (err: any) {
      this.uploadError = err.message ?? 'Greška prilikom otpremanja slike.';
    } finally {
      this.uploading = false;
    }
  }

  startEdit() {
    if (!this.profile) return;
    this.editUsername = this.profile.username;
    this.editHeight = this.profile.height;
    this.editWeight = this.profile.weight;
    this.saveError = '';
    this.editing = true;
  }

  cancelEdit() {
    this.editing = false;
  }

  async saveEdit() {
    if (!this.profile || this.saving) return;

    if (!this.editUsername.trim()) {
      this.saveError = 'Korisničko ime je obavezno.';
      return;
    }

    this.saving = true;
    this.saveError = '';

    try {
      this.profile = await this.profileService.updateProfile(this.profile.id, {
        username: this.editUsername.trim(),
        height: this.editHeight,
        weight: this.editWeight
      });
      this.editing = false;
    } catch (err: any) {
      this.saveError = err.message ?? 'Greška prilikom čuvanja izmena.';
    } finally {
      this.saving = false;
    }
  }
}
