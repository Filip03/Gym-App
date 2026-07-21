import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TrainingService } from '../../services/training.service';
import { AuthService } from '../../services/auth.service';

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

  private currentUserId = '';
  private dayNames = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

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

  toggleLogForm(ex: TodayExercice) {
    ex.showLogForm = !ex.showLogForm;
    ex.repsInput = null;
    ex.weightInput = null;
  }

  async saveLog(ex: TodayExercice) {
    if (ex.repsInput == null || ex.weightInput == null || ex.saving) return;

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
