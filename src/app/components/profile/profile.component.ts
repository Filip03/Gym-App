import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfileService, ProgressPoint } from '../../services/profile.service';
import { ExerciceService, MuscleGroupWithExercices } from '../../services/exercice.service';
import { Profile } from '../../models/models';

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

  exerciceGroups: MuscleGroupWithExercices[] = [];
  loadingExerciceGroups = true;
  selectedExerciceId = '';

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
    } catch (err: any) {
      this.progressError = err.message ?? 'Greška pri učitavanju vežbi.';
    } finally {
      this.loadingExerciceGroups = false;
    }

    try {
      this.otherProfiles = await this.profileService.getOtherProfiles(user.id);
    } catch {
      // Poređenje sa drugim korisnicima jednostavno neće biti ponuđeno
    }

    const preselectedExerciceId = this.route.snapshot.queryParamMap.get('exercice');
    if (preselectedExerciceId) {
      this.selectedExerciceId = preselectedExerciceId;
      await this.onProgressExerciceChange();
    }
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
