import { Component, OnInit } from '@angular/core';
import { ExerciceService, MuscleGroupWithExercices } from '../../services/exercice.service';
import { Exercice, MuscleGroup } from '../../models/models';

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

  // Detaljan prikaz jedne vježbe. Kartice u mreži su nužno tijesne — slika je
  // mala a opis se odsijeca na tri reda — pa se puni sadržaj vidi tek ovdje.

  showCreateModal = false;
  creating = false;
  createError = '';

  newName = '';
  newDescription = '';
  newPictureFile: File | null = null;
  newPicturePreviewUrl: string | null = null;
  newIsBodyweight = false;
  newIsUnilateral = false;
  selectedMuscleGroupIds: string[] = [];

  constructor(private exerciceService: ExerciceService,
    private exDetail: ExerciceDetailService) {}

  async ngOnInit() {
    await this.loadExercices();
  }

  /**
   * Kašnjenje ulazne animacije, u milisekundama.
   *
   * Kartice ulaze jedna za drugom, ali kašnjenje je OGRANIČENO. Katalog ima
   * tridesetak vježbi u desetak grupa; da svaka dobije svoj red, posljednja bi
   * čekala preko dvije sekunde i ekran bi djelovao sporo umjesto tečno. Ovako
   * je najduže čekanje oko 0.7 s, a stepenasti utisak ostaje.
   *
   * Ono što je ispod pregiba se ionako animira dok se ne doskrola, pa se vidi
   * već smireno.
   */
  groupDelay(groupIndex: number): number {
    return Math.min(groupIndex * 70, 350);
  }

  cardDelay(groupIndex: number, cardIndex: number): number {
    return this.groupDelay(groupIndex) + 60 + Math.min(cardIndex * 45, 270);
  }

  private async loadExercices() {
    this.loading = true;
    this.errorMessage = '';

    try {
      // Jedan poziv, ne dva: `getExercicesGroupedByMuscleGroup` i sam iznutra
      // zove `getMuscleGroups`, pa je zaseban poziv bio isti upit poslat dvaput,
      // i to serijski — čekanje bez ijednog novog podatka. Spisak grupa za
      // modal „nova vježba" se izvodi iz istog rezultata; redoslijed je isti
      // (grupe stižu poređane po nazivu), a `uncategorized` je izmišljena grupa
      // iz servisa, ne red u bazi, pa se ne nudi za označavanje.
      this.groups = await this.exerciceService.getExercicesGroupedByMuscleGroup();
      this.muscleGroups = this.groups
        .filter(g => g.id !== 'uncategorized')
        .map(g => ({ id: g.id, name: g.name }));
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška pri učitavanju vježbi.';
    } finally {
      this.loading = false;
    }
  }

  openDetail(ex: Exercice) {
    // Vježba može pripadati većem broju grupa; skupljaju se iz već učitanih
    // grupa umjesto novog upita. Pregled otvara GLOBALNI sloj u ljusci
    // (ExerciceDetailService) — u toku stranice bi potonuo pod futer.
    const groups = this.groups
      .filter(g => g.exercices.some(e => e.id === ex.id))
      .map(g => g.name);
    this.exDetail.open(ex, groups);
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.newName = '';
    this.newDescription = '';
    this.newPictureFile = null;
    this.newPicturePreviewUrl = null;
    this.newIsBodyweight = false;
    this.newIsUnilateral = false;
    this.selectedMuscleGroupIds = [];
    this.createError = '';
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  clearPicture(input: HTMLInputElement) {
    if (this.newPicturePreviewUrl) URL.revokeObjectURL(this.newPicturePreviewUrl);
    this.newPictureFile = null;
    this.newPicturePreviewUrl = null;
    input.value = '';   // da isti fajl može ponovo da se izabere
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
        pictureFile: this.newPictureFile,
        isBodyweight: this.newIsBodyweight,
        isUnilateral: this.newIsUnilateral
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
