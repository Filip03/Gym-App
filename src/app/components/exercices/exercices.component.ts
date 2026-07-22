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
  newPictureFile: File | null = null;
  newPicturePreviewUrl: string | null = null;
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
      this.errorMessage = err.message ?? 'Greška pri učitavanju vježbi.';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.newName = '';
    this.newDescription = '';
    this.newPictureFile = null;
    this.newPicturePreviewUrl = null;
    this.selectedMuscleGroupIds = [];
    this.createError = '';
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  onPictureFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (this.newPicturePreviewUrl) {
      URL.revokeObjectURL(this.newPicturePreviewUrl);
    }

    this.newPictureFile = file;
    this.newPicturePreviewUrl = file ? URL.createObjectURL(file) : null;
  }

  getExercicePictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
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
      this.createError = 'Naziv vježbe je obavezan.';
      return;
    }

    this.creating = true;

    try {
      await this.exerciceService.addExercice({
        name: this.newName,
        description: this.newDescription,
        muscleGroupIds: this.selectedMuscleGroupIds,
        pictureFile: this.newPictureFile
      });

      await this.loadExercices();
      this.closeCreateModal();
    } catch (err: any) {
      this.createError = err.message ?? 'Greška prilikom dodavanja vježbe.';
    } finally {
      this.creating = false;
    }
  }
}
