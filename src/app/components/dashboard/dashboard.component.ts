import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { WorkoutPlan, PlanType, DayType, Exercice } from '../../models/models';
import { DAY_NAMES } from '../../shared/day-names';
import { ExerciceService } from '../../services/exercice.service';

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

  showViewModal = false;
  viewedPlan: any = null;
  viewLoading = false;
  viewError = '';
  isOwnPlan = false;
  isFollowing = false;
  followLoading = false;

  isMobile = false;
  currentDayIndex = 0;

  showExercicePicker = false;
  pickerDay: DayEntry | null = null;

  private dayNames = DAY_NAMES;

  private planTypeToDayTypes: { [planTypeName: string]: string[] } = {
    'PPL (PUSHPULLLEGS)': ['PUSH', 'PULL', 'LEGS', 'REST'],
    'UL (UPPERLOWER)': ['UPPER', 'LOWER', 'REST'],
    'BRO SPLIT': ['CHEST', 'BACK', 'LEGS', 'ARMS', 'REST'],
    'FULL BODY': ['FULLBODY', 'REST']
  };

  @HostListener('window:resize')
  onResize() {
    this.checkIfMobile();
  }

  private checkIfMobile() {
    this.isMobile = window.innerWidth <= 768;
  }

  constructor(
    private dashboardService: DashboardService,
    private authService: AuthService,
    private exerciceService: ExerciceService,
    private router: Router
  ) {}

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Nisi ulogovan.';
      this.loading = false;
      return;
    }

    this.checkIfMobile();

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

  goToTraining() {
    this.router.navigate(['/training']);
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.initWeekDays();
    this.filteredDayTypes = [];
    this.currentDayIndex = 0;
    this.closeExercicePicker();
  }

  nextDay(totalDays: number) {
    if (this.currentDayIndex < totalDays - 1) {
      this.currentDayIndex++;
    }
  }

  prevDay() {
    if (this.currentDayIndex > 0) {
      this.currentDayIndex--;
    }
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.newPlanName = '';
    this.newPlanDescription = '';
    this.newPlanTypeId = '';
    this.createError = '';
    this.weekDays = [];
    this.filteredDayTypes = [];
    this.closeExercicePicker();
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
      if (day.availableExercices.length > 0) {
        this.openExercicePicker(day);
      }
    } catch (err: any) {
      this.createError = 'Greška pri učitavanju vježbi za ovaj dan.';
    }
  }

  openExercicePicker(day: DayEntry) {
    this.pickerDay = day;
    this.showExercicePicker = true;
  }

  closeExercicePicker() {
    this.showExercicePicker = false;
    this.pickerDay = null;
  }

  // Klik na karticu vježbe je dodaje/uklanja iz izabranih; setovi/ponavljanja
  // se onda kucaju direktno u polja koja se pojave ispod kartice - bez posebnog modala
  toggleExercicePick(exercice: Exercice) {
    if (!this.pickerDay) return;

    const index = this.pickerDay.selectedExercices.findIndex(e => e.exerciceId === exercice.id);
    if (index >= 0) {
      this.pickerDay.selectedExercices.splice(index, 1);
    } else {
      this.pickerDay.selectedExercices.push({
        exerciceId: exercice.id,
        name: exercice.name ?? '',
        targetSets: null,
        targetReps: null
      });
    }
  }

  isExercicePicked(exerciceId: string): boolean {
    return this.pickerDay?.selectedExercices.some(e => e.exerciceId === exerciceId) ?? false;
  }

  getPickedInfo(exerciceId: string): SelectedExercice | undefined {
    return this.pickerDay?.selectedExercices.find(e => e.exerciceId === exerciceId);
  }

  getExercicePictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
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

  async openViewModal(planId: string) {
    this.showViewModal = true;
    this.viewLoading = true;
    this.viewError = '';
    this.viewedPlan = null;
    this.currentDayIndex = 0;
    this.isOwnPlan = false;
    this.isFollowing = false;

    const user = this.authService.getCurrentUser();

    try {
      this.viewedPlan = await this.dashboardService.getFullPlan(planId);
      // sortiraj dane po day_number da budu pon-ned
      this.viewedPlan.workout_days.sort((a: any, b: any) => a.day_number - b.day_number);
      // sortiraj vježbe u svakom danu po order_num
      this.viewedPlan.workout_days.forEach((day: any) => {
        day.day_exercice.sort((a: any, b: any) => a.order_num - b.order_num);
      });

      if (user) {
        this.isOwnPlan = this.viewedPlan.created_by === user.id;
        if (!this.isOwnPlan) {
          this.isFollowing = await this.dashboardService.isFollowingPlan(planId, user.id);
        }
      }
    } catch (err: any) {
      this.viewError = err.message ?? 'Greška pri učitavanju plana.';
    } finally {
      this.viewLoading = false;
    }
  }

  async toggleFollowPlan(event: Event) {
    event.stopPropagation();
    const user = this.authService.getCurrentUser();
    if (!user || !this.viewedPlan || this.followLoading) return;

    this.followLoading = true;

    try {
      if (this.isFollowing) {
        await this.dashboardService.unfollowPlan(this.viewedPlan.id, user.id);
        this.isFollowing = false;
      } else {
        await this.dashboardService.followPlan(this.viewedPlan.id, user.id);
        this.isFollowing = true;
      }
    } catch (err: any) {
      this.viewError = err.message ?? 'Greška prilikom ažuriranja praćenja plana.';
    } finally {
      this.followLoading = false;
    }
  }

  async toggleActivatePlan(event: Event) {
    event.stopPropagation();
    const user = this.authService.getCurrentUser();
    if (!user || !this.viewedPlan || this.followLoading) return;

    this.followLoading = true;
    this.viewError = '';

    try {
      if (this.viewedPlan.active) {
        await this.dashboardService.deactivatePlan(this.viewedPlan.id);
        this.viewedPlan.active = false;
      } else {
        const followedPlanId = await this.dashboardService.getFollowedPlanId(user.id);
        if (followedPlanId) {
          this.viewError = 'Prvo moraš otpratiti trenutni plan da bi aktivirao sopstveni.';
          return;
        }

        await this.dashboardService.activatePlan(this.viewedPlan.id, user.id);
        this.viewedPlan.active = true;
      }
    } catch (err: any) {
      this.viewError = err.message ?? 'Greška prilikom aktivacije plana.';
    } finally {
      this.followLoading = false;
    }
  }

  closeViewModal() {
    this.showViewModal = false;
    this.viewedPlan = null;
    this.viewError = '';
    this.isOwnPlan = false;
    this.isFollowing = false;
  }

  async deletePlan(planId: string, event: Event){
    event.stopPropagation(); // sprečava da klik "probije" i ponovo otvori/zatvori modal
    const confirmed = confirm('Da li si siguran da želiš da obrišeš ovaj plan?');
    if (!confirmed) return;

    try {
      await this.dashboardService.deletePlan(planId);
      this.closeViewModal();

      const user = this.authService.getCurrentUser();
      if (user) {
        this.myPlans = await this.dashboardService.getMyPlans(user.id);
      }
    } catch (err: any) {
      this.viewError = err.message ?? 'Greška prilikom brisanja plana.';
    }
    }
}