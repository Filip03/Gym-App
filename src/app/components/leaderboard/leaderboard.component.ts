import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeaderboardService, LeaderboardEntry } from '../../services/leaderboard.service';
import { MuscleGroupWithExercices } from '../../services/exercice.service';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  exerciceGroups: MuscleGroupWithExercices[] = [];
  selectedExerciceId = '';

  entries: LeaderboardEntry[] = [];

  loadingExercices = true;
  loading = false;
  errorMessage = '';

  constructor(
    private leaderboardService: LeaderboardService,
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
