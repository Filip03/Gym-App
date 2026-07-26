import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LeaderboardService, LeaderboardEntry } from '../../services/leaderboard.service';
import { ExerciceService, MuscleGroupWithExercices } from '../../services/exercice.service';
import {
  PickerGroup, PickerOption, toPickerGroups
} from '../shared/exercice-picker/exercice-picker.component';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  exerciceGroups: MuscleGroupWithExercices[] = [];
  selectedExerciceId = '';

  // Birač vježbe — isti kao u treningu, umjesto sistemskog <select>.
  pickerGroups: PickerGroup[] = [];
  showPicker = false;
  selectedExercice: PickerOption | null = null;

  entries: LeaderboardEntry[] = [];

  loadingExercices = true;
  loading = false;
  errorMessage = '';

  constructor(
    private leaderboardService: LeaderboardService,
    private exerciceService: ExerciceService,
    private route: ActivatedRoute
  ) {}

  pictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
  }

  async ngOnInit() {
    try {
      const groups = await this.leaderboardService.getExerciceGroups();
      this.exerciceGroups = groups.filter(g => g.exercices.length > 0);
      this.pickerGroups = toPickerGroups(this.exerciceGroups);
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju vježbi.';
    } finally {
      this.loadingExercices = false;
    }

    // Iz treninga se dolazi sa ?exercice=..., pa se izbor podešava unaprijed.
    const preselectedExerciceId = this.route.snapshot.queryParamMap.get('exercice');
    if (preselectedExerciceId) {
      this.selectedExerciceId = preselectedExerciceId;
      this.selectedExercice = this.findOption(preselectedExerciceId);
      await this.onExerciceChange();
    }
  }

  onPick(option: PickerOption) {
    this.showPicker = false;
    if (option.id === this.selectedExerciceId) return;

    this.selectedExercice = option;
    this.selectedExerciceId = option.id;
    void this.onExerciceChange();
  }

  private findOption(id: string): PickerOption | null {
    for (const g of this.pickerGroups) {
      const hit = g.items.find(o => o.id === id);
      if (hit) return hit;
    }
    return null;
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
