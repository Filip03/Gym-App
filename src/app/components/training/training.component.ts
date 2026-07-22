import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TrainingService } from '../../services/training.service';
import { AuthService } from '../../services/auth.service';
import { DAY_NAMES } from '../../shared/day-names';

interface LoggedSet {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
  editing: boolean;
  editReps: number | null;
  editWeight: number | null;
  saving: boolean;
}

interface TodayExercice {
  dayExerciceId: string;
  exerciceId: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  loggedSets: LoggedSet[];
  showLogForm: boolean;
  repsInput: number | null;
  weightInput: number | null;
  saving: boolean;
}

interface PreviousSet {
  setNumber: number;
  reps: number;
  weight: number;
}

interface PreviousExerciceGroup {
  exerciceId: string;
  name: string;
  sets: PreviousSet[];
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss']
})
export class TrainingComponent implements OnInit {
  loading = true;
  errorMessage = '';

  plan: any = null;
  todayDayName = '';
  todayDate = '';
  todayWorkoutDay: any = null;
  todayExercices: TodayExercice[] = [];
  isRestDay = false;

  showPreviousModal = false;
  previousSessionDate: string | null = null;
  previousSessionGroups: PreviousExerciceGroup[] = [];

  private currentUserId = '';
  private dayNames = DAY_NAMES;

  constructor(
    private trainingService: TrainingService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Nisi ulogovan.';
      this.loading = false;
      return;
    }

    this.currentUserId = user.id;
    this.todayDayName = this.getTodayDayName();
    this.todayDate = this.getTodayDateString();

    try {
      this.plan = await this.trainingService.getPlanForUser(user.id);

      if (!this.plan) {
        this.errorMessage = 'Nemaš trening za praćenje.';
        return;
      }

      this.todayWorkoutDay = this.plan.workout_days.find(
        (day: any) => day.name === this.todayDayName
      ) ?? null;

      if (!this.todayWorkoutDay) {
        this.errorMessage = `Nema definisanog rasporeda za ${this.todayDayName}.`;
        return;
      }

      const sortedDayExercices = [...this.todayWorkoutDay.day_exercice].sort(
        (a: any, b: any) => a.order_num - b.order_num
      );

      this.isRestDay = sortedDayExercices.length === 0;

      this.todayExercices = sortedDayExercices.map((dayEx: any) => ({
        dayExerciceId: dayEx.id,
        exerciceId: dayEx.exercice_id,
        name: dayEx.exercices?.name ?? '',
        targetSets: dayEx.target_sets,
        targetReps: dayEx.target_reps,
        loggedSets: [],
        showLogForm: false,
        repsInput: null,
        weightInput: null,
        saving: false
      }));

      if (!this.isRestDay) {
        await this.loadLoggedSets();
        await this.loadPreviousSession();
      }
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju treninga.';
    } finally {
      this.loading = false;
    }
  }

  private async loadLoggedSets() {
    const exerciceIds = this.todayExercices.map(ex => ex.exerciceId);
    const logs = await this.trainingService.getTodayLogs(
      this.currentUserId,
      this.plan.id,
      exerciceIds,
      this.todayDate
    );

    for (const ex of this.todayExercices) {
      ex.loggedSets = logs
        .filter(log => log.exercice_id === ex.exerciceId)
        .map(log => ({
          id: log.id,
          setNumber: log.set_number,
          reps: log.reps,
          weight: log.weight,
          editing: false,
          editReps: null,
          editWeight: null,
          saving: false
        }));
    }
  }

  private async loadPreviousSession() {
    const exerciceIds = this.getSameTypeExerciceIds();

    const previousDate = await this.trainingService.getPreviousSessionDate(
      this.currentUserId,
      this.plan.id,
      exerciceIds,
      this.todayDate
    );

    if (!previousDate) return;

    const results = await this.trainingService.getSessionResults(
      this.currentUserId,
      this.plan.id,
      exerciceIds,
      previousDate
    );

    const grouped = new Map<string, PreviousExerciceGroup>();
    for (const log of results) {
      if (!grouped.has(log.exercice_id)) {
        grouped.set(log.exercice_id, { exerciceId: log.exercice_id, name: log.name, sets: [] });
      }
      grouped.get(log.exercice_id)!.sets.push({
        setNumber: log.set_number,
        reps: log.reps,
        weight: log.weight
      });
    }

    this.previousSessionDate = previousDate;
    this.previousSessionGroups = Array.from(grouped.values());
  }

  // Sve vježbe iz svih dana u planu koji dele isti tip dana kao danas
  // (npr. i petak i ponedeljak ako su oba "Push"), ne samo današnji spisak
  private getSameTypeExerciceIds(): string[] {
    const typeName = this.todayWorkoutDay?.day_type?.name;

    if (!typeName) {
      return this.todayExercices.map(ex => ex.exerciceId);
    }

    const matchingDays = (this.plan.workout_days ?? []).filter(
      (day: any) => day.day_type?.name === typeName
    );

    const ids = new Set<string>();
    for (const day of matchingDays) {
      for (const dayEx of day.day_exercice ?? []) {
        if (dayEx.exercice_id) ids.add(dayEx.exercice_id);
      }
    }

    return Array.from(ids);
  }

  togglePreviousModal() {
    this.showPreviousModal = !this.showPreviousModal;
  }

  toggleLogForm(ex: TodayExercice) {
    ex.showLogForm = !ex.showLogForm;
    ex.repsInput = null;
    ex.weightInput = null;
  }

  async saveLog(ex: TodayExercice) {
    if (ex.repsInput == null || ex.weightInput == null || ex.saving) return;
    if (ex.weightInput < 2.5 || ex.weightInput > 500) return;

    ex.saving = true;

    try {
      const nextSetNumber = ex.loggedSets.length + 1;
      const saved = await this.trainingService.logSet({
        userId: this.currentUserId,
        exerciceId: ex.exerciceId,
        planId: this.plan.id,
        date: this.todayDate,
        setNumber: nextSetNumber,
        reps: ex.repsInput,
        weight: ex.weightInput
      });

      ex.loggedSets.push({
        id: saved.id,
        setNumber: saved.set_number,
        reps: saved.reps,
        weight: saved.weight,
        editing: false,
        editReps: null,
        editWeight: null,
        saving: false
      });
      ex.showLogForm = false;
      ex.repsInput = null;
      ex.weightInput = null;
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom upisa rezultata.';
    } finally {
      ex.saving = false;
    }
  }

  startEditSet(set: LoggedSet) {
    set.editing = true;
    set.editReps = set.reps;
    set.editWeight = set.weight;
  }

  cancelEditSet(set: LoggedSet) {
    set.editing = false;
  }

  async saveEditSet(set: LoggedSet) {
    if (set.editReps == null || set.editWeight == null || set.saving) return;
    if (set.editWeight < 2.5 || set.editWeight > 500) return;

    set.saving = true;

    try {
      const updated = await this.trainingService.updateLog(set.id, set.editReps, set.editWeight);
      set.reps = updated.reps;
      set.weight = updated.weight;
      set.editing = false;
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom izmene rezultata.';
    } finally {
      set.saving = false;
    }
  }

  private getTodayDayName(): string {
    const jsDay = new Date().getDay(); // 0 = Nedelja, 1 = Ponedeljak, ... 6 = Subota
    const index = jsDay === 0 ? 6 : jsDay - 1;
    return this.dayNames[index];
  }

  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  goToLeaderboard(ex: TodayExercice) {
    this.router.navigate(['/leaderboard'], { queryParams: { exercice: ex.exerciceId } });
  }

  goToProgress(ex: TodayExercice) {
    this.router.navigate(['/profiles'], { queryParams: { exercice: ex.exerciceId } });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
