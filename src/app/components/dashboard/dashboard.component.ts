import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { WorkoutPlan, PlanType, DayType, Exercice } from '../../models/models';

interface SelectedExercice {
  exerciceId: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
}

interface DayEntry {
  dayNumber: number;
  dayName: string;
  dayTypeId: string | null;
  availableExercices: Exercice[];
  selectedExercices: SelectedExercice[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  myPlans: any[] = [];
  otherPlans: any[] = [];
  planTypes: PlanType[] = [];
  dayTypes: DayType[] = [];

  loading = true;
  errorMessage = '';

  showCreateModal = false;
  creating = false;
  createError = '';

  newPlanName = '';
  newPlanDescription = '';
  newPlanTypeId = '';

  weekDays: DayEntry[] = [];
  filteredDayTypes: DayType[] = [];

  private dayNames = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];

  private planTypeToDayTypes: { [planTypeName: string]: string[] } = {
    'PPL (PUSHPULLLEGS)': ['PUSH', 'PULL', 'LEGS', 'REST'],
    'UL (UPPERLOWER)': ['UPPER', 'LOWER', 'REST'],
    'BRO SPLIT': ['CHEST', 'BACK', 'LEGS', 'ARMS', 'REST'],
    'FULL BODY': ['FULLBODY', 'REST']
  };

  constructor(
    private dashboardService: DashboardService,
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

    try {
      this.myPlans = await this.dashboardService.getMyPlans(user.id);
      this.otherPlans = await this.dashboardService.getOtherPlans(user.id);
      this.planTypes = await this.dashboardService.getPlanTypes();
      this.dayTypes = await this.dashboardService.getDayTypes();
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju podataka.';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.initWeekDays();
    this.filteredDayTypes = [];
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.newPlanName = '';
    this.newPlanDescription = '';
    this.newPlanTypeId = '';
    this.createError = '';
    this.weekDays = [];
    this.filteredDayTypes = [];
  }

  private initWeekDays() {
    this.weekDays = this.dayNames.map((name, index) => ({
      dayNumber: index + 1,
      dayName: name,
      dayTypeId: null,
      availableExercices: [],
      selectedExercices: []
    }));
  }

  onPlanTypeChange() {
    const selectedType = this.planTypes.find(pt => pt.id === this.newPlanTypeId);

    if (!selectedType || !selectedType.name) {
      this.filteredDayTypes = [];
      return;
    }

    const allowedNames = this.planTypeToDayTypes[selectedType.name.toUpperCase()];

    if (!allowedNames) {
      this.filteredDayTypes = this.dayTypes;
      return;
    }

    this.filteredDayTypes = this.dayTypes.filter(dt =>
      dt.name && allowedNames.includes(dt.name.toUpperCase())
    );
  }

  async onDayTypeChange(day: DayEntry) {
    day.selectedExercices = [];

    const selectedDayType = this.dayTypes.find(dt => dt.id === day.dayTypeId);
    const isRest = selectedDayType?.name?.toUpperCase() === 'REST';

    if (!day.dayTypeId || isRest) {
      day.availableExercices = [];
      return;
    }

    try {
      day.availableExercices = await this.dashboardService.getExercicesForDayType(day.dayTypeId);
    } catch (err: any) {
      this.createError = 'Greška pri učitavanju vežbi za ovaj dan.';
    }
  }

  isExerciceSelected(day: DayEntry, exerciceId: string): boolean {
    return day.selectedExercices.some(e => e.exerciceId === exerciceId);
  }

  toggleExercice(day: DayEntry, exercice: Exercice) {
    const index = day.selectedExercices.findIndex(e => e.exerciceId === exercice.id);
    if (index >= 0) {
      day.selectedExercices.splice(index, 1);
    } else {
      day.selectedExercices.push({
        exerciceId: exercice.id,
        name: exercice.name ?? '',
        targetSets: null,
        targetReps: null
      });
    }
  }

  async onSubmitPlan() {
    this.createError = '';
    const user = this.authService.getCurrentUser();

    if (!user) {
      this.createError = 'Nisi ulogovan.';
      return;
    }

    if (!this.newPlanName.trim()) {
      this.createError = 'Naziv plana je obavezan.';
      return;
    }

    this.creating = true;

    try {
      const daysPayload = this.weekDays.map(day => ({
        dayNumber: day.dayNumber,
        dayName: day.dayName,
        dayTypeId: day.dayTypeId,
        exercices: day.selectedExercices.map((ex, index) => ({
          exerciceId: ex.exerciceId,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          orderNum: index + 1
        }))
      }));

      await this.dashboardService.createFullPlan(
        {
          name: this.newPlanName,
          description: this.newPlanDescription,
          plan_type_id: this.newPlanTypeId,
          created_by: user.id
        },
        daysPayload
      );

      this.myPlans = await this.dashboardService.getMyPlans(user.id);
      this.closeCreateModal();
    } catch (err: any) {
      this.createError = err.message ?? 'Greška prilikom kreiranja plana.';
    } finally {
      this.creating = false;
    }
  }
}