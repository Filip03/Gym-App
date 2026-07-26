import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeaderboardService, LeaderboardEntry } from '../../services/leaderboard.service';
import { ExerciceService, MuscleGroupWithExercices } from '../../services/exercice.service';
import { Exercice } from '../../models/models';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  exerciceGroups: MuscleGroupWithExercices[] = [];
  selectedExerciceId = '';
  showExercicePicker = false;

  entries: LeaderboardEntry[] = [];

  loadingExercices = true;
  loading = false;
  errorMessage = '';

  constructor(
    private leaderboardService: LeaderboardService,
    private exerciceService: ExerciceService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    try {
      const groups = await this.leaderboardService.getExerciceGroups();
      this.exerciceGroups = groups.filter(g => g.exercices.length > 0);
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju vježbi.';
    } finally {
      this.loadingExercices = false;
    }

    const preselectedExerciceId = this.route.snapshot.queryParamMap.get('exercice');
    if (preselectedExerciceId) {
      this.selectedExerciceId = preselectedExerciceId;
      await this.onExerciceChange();
    }
  }

  get selectedExercice(): Exercice | null {
    for (const group of this.exerciceGroups) {
      const found = group.exercices.find(ex => ex.id === this.selectedExerciceId);
      if (found) return found;
    }
    return null;
  }

  getExercicePictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
  }

  openExercicePicker() {
    if (this.loadingExercices) return;
    this.showExercicePicker = true;
  }

  closeExercicePicker() {
    this.showExercicePicker = false;
  }

  selectExercice(ex: Exercice) {
    this.selectedExerciceId = ex.id;
    this.showExercicePicker = false;
    this.onExerciceChange();
  }

  async onExerciceChange() {
    this.entries = [];
    this.errorMessage = '';

    if (!this.selectedExerciceId) return;

    this.loading = true;

    try {
      this.entries = await this.leaderboardService.getLeaderboard(this.selectedExerciceId);
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju leaderboard-a.';
    } finally {
      this.loading = false;
    }
  }
}
