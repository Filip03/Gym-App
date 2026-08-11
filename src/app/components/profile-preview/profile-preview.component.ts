import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ProfileService, TrainingDay } from '../../services/profile.service';
import { TrainingService } from '../../services/training.service';
import { Profile } from '../../models/models';

/** Plan koji korisnik prati — sopstveni (active=true) ili tuđi (plan_members). */
interface FollowedPlan {
  name: string;
  typeName: string;
  authorUsername: string;
}

/** Jedno polje u kalendaru treninga — ista logika kao profile.component.ts. */
interface CalCell {
  iso: string;
  day: number;
  level: number;
  sets: number;
  today: boolean;
  future: boolean;
}

const STAT_RANGES: { weeks: number; label: string }[] = [
  { weeks: 1,  label: '1s' },
  { weeks: 4,  label: '1m' },
  { weeks: 13, label: '3m' },
  { weeks: 52, label: '1g' }
];

const MONTHS = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
];

/**
 * Brzi pregled tuđeg profila — otvara se kad se klikne na nečiju profilnu
 * sliku (leaderboard, blog). Isti kalendar treninga kao na sopstvenom profilu
 * (profile.component.ts), samo bez ičega što se može mijenjati (težina, upis
 * progresa) — ovo je read-only pogled na drugog korisnika.
 */
@Component({
  selector: 'app-profile-preview',
  templateUrl: './profile-preview.component.html',
  styleUrls: ['./profile-preview.component.scss']
})
export class ProfilePreviewComponent implements OnChanges {
  @Input() userId: string | null = null;
  /** Izlazna animacija u toku (drži je ProfilePreviewService). */
  @Input() closing = false;
  @Output() closed = new EventEmitter<void>();

  loading = false;
  errorMessage = '';
  profile: Profile | null = null;
  avatarUrl: string | null = null;

  planLoading = false;
  plan: FollowedPlan | null = null;

  // --- Kalendar treninga (isto kao profile.component.ts) ----------------------
  calLoading = true;
  calDays: TrainingDay[] = [];
  calCells: CalCell[] = [];
  calLead = 0;
  calTitle = '';
  calAtCurrentMonth = true;
  readonly statRanges = STAT_RANGES;
  statRange = 4;

  rangeCount = 0;
  rangeSets = 0;
  rangeAvg = '—';
  rangePerDay = '—';
  rangeBestDay = 0;
  weekStreak = 0;

  monthCount = 0;
  readonly weekLabels = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];
  private calCursor = new Date();

  constructor(
    private profileService: ProfileService,
    private trainingService: TrainingService
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (!('userId' in changes)) return;
    if (this.userId) {
      void this.load(this.userId);
    }
  }

  private async load(userId: string) {
    this.loading = true;
    this.errorMessage = '';
    this.profile = null;
    this.avatarUrl = null;
    this.plan = null;
    this.calLoading = true;
    this.calCursor = new Date();

    void this.loadCalendar(userId);   // ne čeka profil, puni se paralelno
    void this.loadPlan(userId);

    try {
      this.profile = await this.profileService.getProfile(userId);
      this.avatarUrl = this.profile.profile_pic_url
        ? this.profileService.getPublicUrl(this.profile.profile_pic_url)
        : null;
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju profila.';
    } finally {
      this.loading = false;
    }
  }

  close() {
    this.closed.emit();
  }

  /**
   * Plan koji korisnik prati — isti izvor kao trening ekran: prvo plan_members
   * (tuđi plan koji prati), inače sopstveni plan sa active=true (ili jedini
   * ako ima samo jedan). Vidi TrainingService.getPlanForUser().
   */
  private async loadPlan(userId: string) {
    this.planLoading = true;

    try {
      const full = await this.trainingService.getPlanForUser(userId);
      this.plan = full ? {
        name: full.name ?? '',
        typeName: full.plan_type?.name ?? '',
        authorUsername: full.profiles?.username ?? ''
      } : null;
    } catch {
      // Info o planu je dodatak; greška ovdje ne smije oboriti ostatak pregleda.
      this.plan = null;
    } finally {
      this.planLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Kalendar treninga — ista logika kao profile.component.ts, ovdje samo za
  // korisnika koji se gleda umjesto za trenutno prijavljenog.
  // ---------------------------------------------------------------------------

  private async loadCalendar(userId: string) {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    try {
      this.calDays = await this.profileService.getTrainingCalendar(userId, this.iso(since));
      this.weekStreak = this.computeWeekStreak();
      this.computeRangeStats();
      this.buildMonth();
    } catch {
      // Kalendar je dodatak; greška ovdje ne smije oboriti ostatak pregleda.
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
        level: trained ? 1 + Math.min(3, Math.floor((sets ?? 0) / 8)) : 0,
        today: iso === todayIso,
        future: iso > todayIso
      });
    }

    this.monthCount = inMonth;
  }

  private computeWeekStreak(): number {
    if (this.calDays.length === 0) return 0;

    const weeks = new Set(this.calDays.map(d => this.mondayIso(new Date(`${d.date}T12:00:00`))));

    const cursor = new Date();
    let key = this.mondayIso(cursor);
    let streak = 0;

    if (!weeks.has(key)) {
      cursor.setDate(cursor.getDate() - 7);
      key = this.mondayIso(cursor);
    }

    while (weeks.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
      key = this.mondayIso(cursor);
    }

    return streak;
  }

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
  private iso(d: Date): string {
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  trackCell = (_: number, c: CalCell) => c.iso;
}
