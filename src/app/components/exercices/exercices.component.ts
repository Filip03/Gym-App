import { Component, OnInit } from '@angular/core';
import { ExerciceService, MuscleGroupWithExercices } from '../../services/exercice.service';
import { MuscleGroup } from '../../models/models';

@Component({
  selector: 'app-exercices',
  templateUrl: './exercices.component.html',
  styleUrls: ['./exercices.component.scss']
})
export class ExercicesComponent implements OnInit {
  loading = true;
  errorMessage = '';

  groups: MuscleGroupWithExercices[] = [];
  muscleGroups: MuscleGroup[] = [];

  showCreateModal = false;
  creating = false;
  createError = '';

  newName = '';
  newDescription = '';
  newPicture = '';
  selectedMuscleGroupIds: string[] = [];

  constructor(private exerciceService: ExerciceService) {}

  async ngOnInit() {
    await this.loadExercices();
  }

  private async loadExercices() {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.muscleGroups = await this.exerciceService.getMuscleGroups();
      this.groups = await this.exerciceService.getExercicesGroupedByMuscleGroup();
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju vežbi.';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.newName = '';
    this.newDescription = '';
    this.newPicture = '';
    this.selectedMuscleGroupIds = [];
    this.createError = '';
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  toggleMuscleGroup(muscleGroupId: string) {
    const index = this.selectedMuscleGroupIds.indexOf(muscleGroupId);
    if (index >= 0) {
      this.selectedMuscleGroupIds.splice(index, 1);
    } else {
      this.selectedMuscleGroupIds.push(muscleGroupId);
    }
  }

  isMuscleGroupSelected(muscleGroupId: string): boolean {
    return this.selectedMuscleGroupIds.includes(muscleGroupId);
  }

  async onSubmitExercice() {
    this.createError = '';

    if (!this.newName.trim()) {
      this.createError = 'Naziv vežbe je obavezan.';
      return;
    }

    this.creating = true;

    try {
      await this.exerciceService.addExercice({
        name: this.newName,
        description: this.newDescription,
        picture: this.newPicture,
        muscleGroupIds: this.selectedMuscleGroupIds
      });

      await this.loadExercices();
      this.closeCreateModal();
    } catch (err: any) {
      this.createError = err.message ?? 'Greška prilikom dodavanja vežbe.';
    } finally {
      this.creating = false;
    }
  }
}
