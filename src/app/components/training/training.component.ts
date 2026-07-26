import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ExerciceService } from '../../services/exercice.service';
import { AudioService } from '../../services/audio.service';
import { humanError } from '../../shared/errors';
import { Router } from '@angular/router';
import {
  TrainingService, WorkoutSession, SessionExercice, Echo, EchoSet
} from '../../services/training.service';

/** Poređenje jedne serije sa istom serijom prošlog treninga. */
type Delta = 'up' | 'down' | 'same' | null;

interface LoggedSet {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;

  /** Ukupna ocjena serije — boji obrub i strelicu. */
  delta: Delta;
  /** Šta se tačno promijenilo, da se može naglasiti baš taj broj. */
  weightDelta: Delta;
  repsDelta: Delta;
  /** Prošli rezultat te serije, za opis pri prelasku mišem. */
  prevLabel: string | null;
  editing: boolean;
  editReps: number | null;
  editWeight: number | null;
  saving: boolean;
}

interface TodayExercice extends SessionExercice {
  loggedSets: LoggedSet[];
  echo: Echo | null;

  /** Najbolja kilaža PRIJE današnjeg treninga. Prag za lični rekord. */
  previousBest: number | null;
  /** Da li je današnji trening oborio taj prag. Jedan po vježbi, ne po seriji. */
  isPr: boolean;
  /** Uključuje se samo u trenutku obaranja — pokreće animaciju slavlja. */
  celebrating: boolean;
  /** Mijenja se pri svakom slavlju da bi se snimak odsvirao ispočetka. */
  celebrateKey: number;
  /** Kilaža za koju je plamen već odsviran — sprječava ponavljanje pri svakom dodiru. */
  prShown: number | null;

  showLogForm: boolean;
  repsInput: number | null;
  weightInput: number | null;
  saving: boolean;
  menuOpen: boolean;
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss']
})
export class TrainingComponent implements OnInit {
  loading = true;
  errorMessage = '';

  session: WorkoutSession | null = null;
  todayDate = '';
  exercices: TodayExercice[] = [];
  isRestDay = false;

  // Zamjena vježbe
  showSwapModal = false;
  swapTarget: TodayExercice | null = null;
  swapMode: 'replace' | 'add' = 'replace';
  swapOptions: { id: string; name: string; picture: string | null }[] = [];
  swapLoading = false;
  swapFilter = '';
  swapSaving = false;

  /** Režim preređivanja: redovi se svode na naziv + strelice. */
  reordering = false;
  reorderSaving = false;
  /** Vježba koja se upravo pomjerila — ostaje istaknuta da se vidi šta se desilo. */
  movedId: string | null = null;

  @ViewChildren('exRow') rowEls!: QueryList<ElementRef<HTMLElement>>;

  // Izmjena cilja za ovaj trening
  showTargetModal = false;
  targetTarget: TodayExercice | null = null;
  targetSetsInput: number | null = null;
  targetRepsInput: number | null = null;

  private currentUserId = '';

  constructor(
    private trainingService: TrainingService,
    private exerciceService: ExerciceService,
    private authService: AuthService,
    private audio: AudioService,
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
    this.todayDate = this.todayString();

    try {
      const plan = await this.trainingService.getPlanForUser(user.id);
      this.session = await this.trainingService.getOrCreateSession(user.id, this.todayDate, plan);

      if (!this.session) {
        this.errorMessage = plan
          ? 'Nema definisanog rasporeda za danas.'
          : 'Nemaš plan koji pratiš. Napravi ga ili zaprati tuđi na ekranu Planovi.';
        return;
      }

      await this.hydrate();
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju treninga.');
    } finally {
      this.loading = false;
    }
  }

  /** Napuni ekran: vježbe iz sesije + upisane serije + echo + rekordi. */
  private async hydrate() {
    if (!this.session) return;

    const exerciceIds = this.session.exercices.map(e => e.exerciceId);
    this.isRestDay = exerciceIds.length === 0;

    // Tri nezavisna upita — paralelno, da ekran ne čeka lanac.
    const [logs, echo, bests] = await Promise.all([
      this.trainingService.getSessionLogs(this.session.id),
      this.trainingService.getEcho(this.currentUserId, exerciceIds, this.todayDate),
      this.trainingService.getPersonalBests(this.currentUserId, exerciceIds, this.todayDate)
    ]);

    this.exercices = this.session.exercices.map(se => {
      const own = logs.filter(l => l.exercice_id === se.exerciceId);
      const ec = echo.get(se.exerciceId) ?? null;
      const previousBest = bests.get(se.exerciceId) ?? null;

      const sets: LoggedSet[] = own.map(l => ({
        id: l.id,
        setNumber: l.set_number,
        reps: l.reps,
        weight: l.weight,
        ...this.compare(ec, l.set_number, l.weight, l.reps),
        editing: false,
        editReps: null,
        editWeight: null,
        saving: false
      }));

      const isPr = this.hasPr(sets, previousBest);

      return {
        ...se,
        echo: ec,
        previousBest,
        isPr,
        // Zatečeni rekord se NE slavi pri učitavanju ekrana — samo onaj koji
        // padne pred korisnikom.
        prShown: isPr ? Math.max(...sets.map(s => s.weight)) : null,
        celebrating: false,
        celebrateKey: 0,
        loggedSets: sets,
        showLogForm: false,
        repsInput: null,
        weightInput: null,
        saving: false,
        menuOpen: false
      };
    });
  }

  /**
   * Poređenje SERIJE sa istom serijom prošlog treninga.
   *
   * Pravilo: kilaža je jača od ponavljanja. Veća kilaža je uvijek napredak;
   * ista kilaža uz više ponavljanja je takođe napredak; manja kilaža je nazadak
   * bez obzira na ponavljanja.
   *
   * Pored ukupne ocjene vraća i pojedinačne, da se u prikazu može naglasiti
   * BAŠ ono što je poraslo — inače se iz "95kg × 11" ne vidi da li je porasla
   * kilaža ili broj ponavljanja.
   */
  private compare(echo: Echo | null, setNumber: number, weight: number, reps: number): {
    delta: Delta; weightDelta: Delta; repsDelta: Delta; prevLabel: string | null;
  } {
    const prev = echo?.sets.find(s => s.setNumber === setNumber);
    if (!prev) {
      return { delta: null, weightDelta: null, repsDelta: null, prevLabel: null };
    }

    const cmp = (a: number, b: number): Delta => a > b ? 'up' : a < b ? 'down' : 'same';

    const weightDelta = cmp(weight, prev.weight);
    const repsDelta = cmp(reps, prev.reps);

    const delta: Delta =
      weightDelta !== 'same' ? weightDelta :
      repsDelta;

    return {
      delta,
      weightDelta,
      repsDelta,
      prevLabel: `Prošli put: ${prev.weight}kg × ${prev.reps}`
    };
  }

  /**
   * Lični rekord se računa na nivou VJEŽBE, ne serije.
   *
   * Ranije je svaka serija teža od prethodne dobijala plamen, pa je trening
   * 70-72-74 kg davao tri "rekorda". Sada je rekord jedan: najteža današnja
   * serija naspram svega ranije odrađenog.
   *
   * Vježba bez ijednog ranijeg upisa NEMA rekord — prvi put kad nešto radiš
   * nije dostignuće, nema se šta nadmašiti.
   */
  private hasPr(sets: LoggedSet[], previousBest: number | null): boolean {
    if (sets.length === 0 || previousBest === null) return false;
    return Math.max(...sets.map(s => s.weight)) > previousBest;
  }

  /**
   * Preračunaj rekord i, ako je prag upravo pređen, pokreni slavlje.
   *
   * Zove se iz SVAKE radnje koja mijenja serije — upisa, izmjene i brisanja.
   * Ranije je slavlje visjelo samo na upisu nove serije, pa izmjena postojeće
   * na veću kilažu nije davala ništa iako je rekord stvarno pao.
   *
   * `prShown` pamti kilažu za koju je plamen već odsviran, pa se animacija ne
   * ponavlja pri svakom dodiru — ali se pokreće ponovo ako rekord naraste još
   * jednom u istom treningu.
   */
  private refreshPr(ex: TodayExercice) {
    ex.isPr = this.hasPr(ex.loggedSets, ex.previousBest);

    if (!ex.isPr) {
      ex.prShown = null;
      return;
    }

    const best = this.todayBest(ex)!;
    if (ex.prShown !== null && best <= ex.prShown) return;

    ex.prShown = best;
    ex.celebrateKey = Date.now();
    ex.celebrating = true;
    this.audio.play('record');
    setTimeout(() => ex.celebrating = false, 1800);   // dužina snimka
  }

  /** Najteža današnja serija — prikazuje se uz oznaku rekorda. */
  todayBest(ex: TodayExercice): number | null {
    if (ex.loggedSets.length === 0) return null;
    return Math.max(...ex.loggedSets.map(s => s.weight));
  }

  // -------------------------------------------------------------------------
  // Echo — vrijednosti prošlog treninga
  // -------------------------------------------------------------------------

  /** Prošli trening za seriju koju korisnik upravo upisuje. */
  echoFor(ex: TodayExercice, setNumber: number): EchoSet | null {
    return ex.echo?.sets.find(s => s.setNumber === setNumber) ?? null;
  }

  nextSetNumber(ex: TodayExercice): number {
    return ex.loggedSets.length + 1;
  }

  /** Tekst u polju prije nego što korisnik išta ukuca. */
  echoPlaceholder(ex: TodayExercice, field: 'reps' | 'weight'): string {
    const prev = this.echoFor(ex, this.nextSetNumber(ex));
    if (!prev) return field === 'reps' ? 'Ponavljanja' : 'Kilaža';
    return field === 'reps' ? `${prev.reps}` : `${prev.weight}`;
  }

  /** Koliko je serija plan predvidio, a koliko ih je odrađeno. */
  progressLabel(ex: TodayExercice): string {
    const done = ex.loggedSets.length;
    return ex.targetSets ? `${done}/${ex.targetSets}` : `${done}`;
  }

  isComplete(ex: TodayExercice): boolean {
    return !!ex.targetSets && ex.loggedSets.length >= ex.targetSets;
  }

  // -------------------------------------------------------------------------
  // Upis serije
  // -------------------------------------------------------------------------

  toggleLogForm(ex: TodayExercice) {
    ex.showLogForm = !ex.showLogForm;
    ex.menuOpen = false;

    // Predloži prošli rezultat kao polaznu vrijednost — u teretani se najčešće
    // ponavlja isto ili se dodaje mali korak.
    const prev = this.echoFor(ex, this.nextSetNumber(ex));
    ex.repsInput = ex.showLogForm ? prev?.reps ?? null : null;
    ex.weightInput = ex.showLogForm ? prev?.weight ?? null : null;
  }

  async saveLog(ex: TodayExercice) {
    if (!this.session) return;
    if (ex.repsInput == null || ex.weightInput == null || ex.saving) return;
    if (ex.weightInput < 0 || ex.weightInput > 1000) return;

    ex.saving = true;

    try {
      const setNumber = this.nextSetNumber(ex);
      const saved = await this.trainingService.logSet({
        userId: this.currentUserId,
        sessionId: this.session.id,
        exerciceId: ex.exerciceId,
        planId: this.session.planId,
        date: this.todayDate,
        setNumber,
        reps: ex.repsInput,
        weight: ex.weightInput
      });

      ex.loggedSets.push({
        id: saved.id,
        setNumber: saved.set_number,
        reps: saved.reps,
        weight: saved.weight,
        ...this.compare(ex.echo, saved.set_number, saved.weight, saved.reps),
        editing: false,
        editReps: null,
        editWeight: null,
        saving: false
      });

      this.refreshPr(ex);

      ex.showLogForm = false;
      ex.repsInput = null;
      ex.weightInput = null;
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom upisa rezultata.');
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

  async saveEditSet(ex: TodayExercice, set: LoggedSet) {
    if (set.editReps == null || set.editWeight == null || set.saving) return;

    set.saving = true;

    try {
      const updated = await this.trainingService.updateLog(set.id, set.editReps, set.editWeight);
      set.reps = updated.reps;
      set.weight = updated.weight;
      Object.assign(set, this.compare(ex.echo, set.setNumber, set.weight, set.reps));
      set.editing = false;

      // Izmjena može i stvoriti i poništiti rekord — zato ista provjera kao
      // pri upisu, uključujući i animaciju.
      this.refreshPr(ex);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom izmjene rezultata.');
    } finally {
      set.saving = false;
    }
  }

  /** Briše seriju i prenumeriše preostale, da rupe ne pomjere Echo poređenje. */
  async deleteSet(ex: TodayExercice, set: LoggedSet) {
    if (set.saving) return;
    set.saving = true;

    try {
      await this.trainingService.deleteLog(set.id);
      ex.loggedSets = ex.loggedSets.filter(s => s.id !== set.id);

      for (let i = 0; i < ex.loggedSets.length; i++) {
        const wanted = i + 1;
        if (ex.loggedSets[i].setNumber !== wanted) {
          await this.trainingService.renumberSet(ex.loggedSets[i].id, wanted);
          ex.loggedSets[i].setNumber = wanted;
          Object.assign(ex.loggedSets[i], this.compare(
            ex.echo, wanted, ex.loggedSets[i].weight, ex.loggedSets[i].reps
          ));
        }
      }

      this.refreshPr(ex);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom brisanja serije.');
      set.saving = false;
    }
  }

  // -------------------------------------------------------------------------
  // Redoslijed vježbi
  // -------------------------------------------------------------------------

  toggleReorder() {
    this.reordering = !this.reordering;
    this.exercices.forEach(e => { e.menuOpen = false; e.showLogForm = false; });
  }

  /**
   * Pomjeranje vježbe gore ili dolje.
   *
   * Mijenja se SAMO današnja sesija. Plan ostaje isti, a ranije sesije čuvaju
   * poredak kojim su tada rađene. Novi poredak se nasljeđuje na sljedeći
   * trening istog dana — vidi TrainingService.rememberedOrder().
   */
  async move(ex: TodayExercice, direction: -1 | 1) {
    if (this.reorderSaving) return;

    const from = this.exercices.indexOf(ex);
    const to = from + direction;
    if (to < 0 || to >= this.exercices.length) return;

    const rows = this.rowEls.toArray().map(r => r.nativeElement);
    const movedEl = rows[from];
    const otherEl = rows[to];
    if (!movedEl || !otherEl) return;

    // FLIP: zapamti gdje su redovi BILI prije zamjene.
    const movedFrom = movedEl.getBoundingClientRect().top;
    const otherFrom = otherEl.getBoundingClientRect().top;

    const list = [...this.exercices];
    [list[from], list[to]] = [list[to], list[from]];
    this.exercices = list;
    this.movedId = ex.id;

    // Angular je već premjestio čvorove; vrati ih vizuelno na staro mjesto pa
    // pusti prelaz — tako se vidi PUTANJA, a ne samo krajnji raspored.
    requestAnimationFrame(() => {
      const after = this.rowEls.toArray().map(r => r.nativeElement);
      const movedNow = after[to];
      const otherNow = after[from];
      if (!movedNow || !otherNow) return;

      const dMoved = movedFrom - movedNow.getBoundingClientRect().top;
      const dOther = otherFrom - otherNow.getBoundingClientRect().top;

      // Pomjerena vježba ide PREKO druge: viši sloj, blago uvećana, sa sjenkom.
      // Druga se malo skuplja i prolazi ispod — otud osjećaj dubine.
      this.flip(movedNow, dMoved, 1.035, 6, true);
      this.flip(otherNow, dOther, 0.985, 1, false);
    });

    this.reorderSaving = true;
    try {
      await this.trainingService.setOrder(list.map((e, i) => ({ id: e.id, orderNum: i + 1 })));
      list.forEach((e, i) => e.orderNum = i + 1);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom promjene redoslijeda.');
      const back = [...this.exercices];
      [back[from], back[to]] = [back[to], back[from]];
      this.exercices = back;
    } finally {
      this.reorderSaving = false;
      setTimeout(() => { if (this.movedId === ex.id) this.movedId = null; }, 900);
    }
  }

  /** Jedan korak FLIP animacije nad jednim redom. */
  private flip(el: HTMLElement, dy: number, scale: number, z: number, lift: boolean) {
    el.style.transition = 'none';
    el.style.zIndex = String(z);
    el.style.transform = `translateY(${dy}px) scale(${scale})`;
    if (lift) el.style.boxShadow = 'var(--lift-3)';

    requestAnimationFrame(() => {
      el.style.transition = 'transform 380ms cubic-bezier(0.34, 1.24, 0.5, 1), box-shadow 380ms ease';
      el.style.transform = 'translateY(0) scale(1)';
      el.style.boxShadow = '';

      const done = () => {
        el.style.transition = '';
        el.style.zIndex = '';
        el.style.transform = '';
        el.removeEventListener('transitionend', done);
      };
      el.addEventListener('transitionend', done);
    });
  }

  /** Bez ovoga Angular pri zamjeni pravi nove čvorove i animacija nema šta da pomjera. */
  trackById = (_: number, ex: TodayExercice) => ex.id;

  isFirst(ex: TodayExercice): boolean { return this.exercices.indexOf(ex) === 0; }
  isLast(ex: TodayExercice): boolean {
    return this.exercices.indexOf(ex) === this.exercices.length - 1;
  }

  // -------------------------------------------------------------------------
  // Zamjena vježbe — samo za ovaj trening
  // -------------------------------------------------------------------------

  toggleMenu(ex: TodayExercice) {
    const open = ex.menuOpen;
    this.exercices.forEach(e => e.menuOpen = false);
    ex.menuOpen = !open;
  }

  /** Dodavanje vježbe koje nema u planu — vrijedi samo za današnji trening. */
  async openAdd() {
    this.swapTarget = null;
    this.swapMode = 'add';
    this.showSwapModal = true;
    this.swapLoading = true;
    this.swapFilter = '';
    this.swapOptions = [];
    this.errorMessage = '';
    this.exercices.forEach(e => e.menuOpen = false);

    try {
      const all = await this.trainingService.getAllExercices();
      const already = new Set(this.exercices.map(e => e.exerciceId));
      this.swapOptions = all.filter(o => !already.has(o.id));
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju vježbi.');
    } finally {
      this.swapLoading = false;
    }
  }

  async openSwap(ex: TodayExercice, mode: 'replace' | 'add') {
    // Upisane serije su vezane za exercice_id, a ne za red u sesiji. Zamjena bi
    // ih ostavila u bazi ali ih sklonila sa ekrana, jer red od tada prikazuje
    // drugu vježbu. Umjesto tihog gubitka podatka — jasna poruka.
    if (mode === 'replace' && ex.loggedSets.length > 0) {
      this.errorMessage =
        `${ex.name} već ima upisane serije. Obriši ih ako želiš zamijeniti vježbu.`;
      ex.menuOpen = false;
      return;
    }

    this.errorMessage = '';
    this.swapTarget = ex;
    this.swapMode = mode;
    this.showSwapModal = true;
    this.swapLoading = true;
    this.swapFilter = '';
    this.swapOptions = [];
    ex.menuOpen = false;

    try {
      this.swapOptions = await this.trainingService.getAlternatives(ex.exerciceId);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju zamjena.');
    } finally {
      this.swapLoading = false;
    }
  }

  closeSwap() {
    this.showSwapModal = false;
    this.swapTarget = null;
  }

  get filteredSwapOptions() {
    const q = this.swapFilter.trim().toLowerCase();
    if (!q) return this.swapOptions;
    return this.swapOptions.filter(o => o.name.toLowerCase().includes(q));
  }

  async confirmSwap(option: { id: string; name: string; picture: string | null }) {
    if (!this.session || this.swapSaving) return;
    if (this.swapMode === 'replace' && !this.swapTarget) return;
    this.swapSaving = true;

    try {
      if (this.swapMode === 'replace') {
        await this.trainingService.replaceExercice(
          this.swapTarget!.id, option.id, this.swapTarget!.exerciceId
        );
      } else {
        const nextOrder = Math.max(0, ...this.exercices.map(e => e.orderNum)) + 1;
        await this.trainingService.addExercice(this.session.id, option.id, nextOrder);
      }

      this.session = await this.trainingService.getOrCreateSession(
        this.currentUserId, this.todayDate, null
      );
      await this.hydrate();
      this.closeSwap();
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom zamjene vježbe.');
    } finally {
      this.swapSaving = false;
    }
  }

  async removeExercice(ex: TodayExercice) {
    if (ex.loggedSets.length > 0) {
      this.errorMessage = 'Vježba ima upisane serije — prvo obriši serije.';
      return;
    }

    ex.menuOpen = false;

    try {
      await this.trainingService.removeExercice(ex.id);
      this.session = await this.trainingService.getOrCreateSession(
        this.currentUserId, this.todayDate, null
      );
      await this.hydrate();
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom uklanjanja vježbe.');
    }
  }

  // -------------------------------------------------------------------------
  // Cilj za ovaj trening
  // -------------------------------------------------------------------------

  openTargets(ex: TodayExercice) {
    this.targetTarget = ex;
    this.targetSetsInput = ex.targetSets;
    this.targetRepsInput = ex.targetReps;
    this.showTargetModal = true;
    ex.menuOpen = false;
  }

  closeTargets() {
    this.showTargetModal = false;
    this.targetTarget = null;
  }

  async saveTargets() {
    if (!this.targetTarget) return;

    try {
      await this.trainingService.updateTargets(
        this.targetTarget.id, this.targetSetsInput, this.targetRepsInput
      );
      this.targetTarget.targetSets = this.targetSetsInput;
      this.targetTarget.targetReps = this.targetRepsInput;
      this.closeTargets();
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom izmjene cilja.');
    }
  }

  // -------------------------------------------------------------------------

  getPictureUrl(picture: string | null): string | null {
    return picture ? this.exerciceService.getPublicUrl(picture) : null;
  }

  goToLeaderboard(ex: TodayExercice) {
    this.router.navigate(['/leaderboard'], { queryParams: { exercice: ex.exerciceId } });
  }

  goToProgress(ex: TodayExercice) {
    this.router.navigate(['/profiles'], { queryParams: { exercice: ex.exerciceId } });
  }

  private todayString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
