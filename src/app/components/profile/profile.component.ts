import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService, ProgressPoint, TrainingDay } from '../../services/profile.service';
import { ExerciceService, MuscleGroupWithExercices } from '../../services/exercice.service';
import { Profile } from '../../models/models';
import {
  PickerGroup, PickerOption, toPickerGroups
} from '../shared/exercice-picker/exercice-picker.component';

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
  monthCount = 0;
  weekStreak = 0;
  yearCount = 0;
  yearSets = 0;
  weekAvg = '0';
  bestMonth = 0;
  readonly weekLabels = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];
  private calCursor = new Date();

  exerciceGroups: MuscleGroupWithExercices[] = [];
  loadingExerciceGroups = true;
  selectedExerciceId = '';

  // Birač vježbe — isti kao u treningu, umjesto sistemskog <select>.
  pickerGroups: PickerGroup[] = [];
  showPicker = false;
  selectedExercice: PickerOption | null = null;

  otherProfiles: { id: string; username: string }[] = [];
  compareUserId = '';
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
  readonly chartPaddingLeft = 46;
  readonly chartPaddingRight = 20;
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
  // Kalendar treninga

  private async loadCalendar(userId: string) {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    try {
      this.calDays = await this.profileService.getTrainingCalendar(userId, this.iso(since));
      this.yearCount = this.calDays.length;
      this.yearSets = this.calDays.reduce((n, d) => n + d.sets, 0);
      this.weekStreak = this.computeWeekStreak();
      this.weekAvg = this.computeWeekAvg();
      this.bestMonth = this.computeBestMonth();
      this.buildMonth();
    } catch {
      // Kalendar je dodatak; greška ovdje ne smije oboriti ostatak profila.
      this.calDays = [];
    } finally {
      this.calLoading = false;
    }
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
   * Prosjek treninga po sedmici, od prvog upisanog dana do danas.
   *
   * Ne dijeli se sa 52 — ko je počeo prije mjesec dana ne zaslužuje prosjek od
   * 0.5 samo zato što ranije nije koristio aplikaciju.
   */
  private computeWeekAvg(): string {
    if (this.calDays.length === 0) return '0';

    const first = new Date(`${this.calDays[0].date}T12:00:00`);
    const days = Math.max(7, (Date.now() - first.getTime()) / 86400000);
    return (this.calDays.length / (days / 7)).toFixed(1).replace('.', ',');
  }

  /** Najviše treninga u jednom kalendarskom mjesecu unutar učitane godine. */
  private computeBestMonth(): number {
    const byMonth = new Map<string, number>();
    for (const d of this.calDays) {
      const key = d.date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    }
    return Math.max(0, ...byMonth.values());
  }

  private mondayIso(d: Date): string {
    const m = new Date(d);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return this.iso(m);
  }

  /** Lokalni datum kao `YYYY-MM-DD`. `toISOString()` uveče vraća sjutrašnji dan. */
  private iso(d: Date): string {
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  trackCell = (_: number, c: CalCell) => c.iso;

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

  private buildAreaPath(points: ChartPoint[], baselineY: number): string {
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
