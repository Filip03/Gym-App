import { Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ExerciceService } from '../../services/exercice.service';
import { AudioService } from '../../services/audio.service';
import { OfflineQueueService } from '../../services/offline-queue.service';
import {
  PickerGroup, PickerOption, toPickerGroups, flattenGroups
} from '../shared/exercice-picker/exercice-picker.component';
import { humanError } from '../../shared/errors';
import { Router } from '@angular/router';
import {
  TrainingService, WorkoutSession, SessionExercice, Echo, EchoSet
} from '../../services/training.service';
import { DropsetLog } from '../../models/models';

/** Poređenje jedne serije sa istom serijom prošlog treninga. */
type Delta = 'up' | 'down' | 'same' | null;

/** Dropset prikazan na ekranu — server podaci plus stanje brisanja. */
interface DropsetEntry extends DropsetLog {
  deleting: boolean;
}

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
  /** Upisano bez mreže — čeka slanje. Ne može se mijenjati dok ne prođe. */
  pending?: boolean;
  editing: boolean;
  editReps: number | null;
  editWeight: number | null;
  saving: boolean;

  /** Dropset(ovi) odrađeni odmah nakon ove working serije. */
  dropsets: DropsetEntry[];
  addingDropset: boolean;
  dropsetWeightInput: number | null;
  dropsetRepsInput: number | null;
  savingDropset: boolean;
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
  /** Za bodyweight vježbe: da li je polje za kilažu otkriveno (podrazumijevano sakriveno). */
  showWeightInput: boolean;
  saving: boolean;
  menuOpen: boolean;
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss']
})
export class TrainingComponent implements OnInit, OnDestroy {
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
  swapLoading = false;
  swapSaving = false;

  // Ulazi za <app-exercice-picker>. Katalog je isti u oba načina; razlikuje se
  // samo uži izbor — „slične vježbe" pri zamjeni, „za današnji dan" pri dodavanju.
  pickerGroups: PickerGroup[] = [];
  pickerSuggested: PickerOption[] | null = null;
  pickerSuggestedLabel = 'Preporučeno';

  // --- Bilješka uz trening ----------------------------------------------------
  //
  // Kolona `note` postoji otkad je tabela napravljena, ali se nikad nije
  // koristila. Ključ je `UNIQUE (user_id, date)`, pa je bilješka po DANU —
  // jedna po treningu, ne po vježbi.
  showNote = false;
  noteText = '';
  noteSaving = false;

  /** Režim preređivanja: redovi se svode na naziv + strelice. */
  reordering = false;
  reorderSaving = false;
  /**
   * Izabrana vježba u režimu preređivanja.
   *
   * Ostaje istaknuta dok se ne poništi — ranije se gasila nakon 1.4s, pa se pri
   * bržem radu gubila iz vida taman kad je najpotrebnija. Poništava se klikom na
   * sam red ili klikom bilo gdje van redova.
   */
  selectedId: string | null = null;

  @ViewChildren('exRow') rowEls!: QueryList<ElementRef<HTMLElement>>;

  private saveTimer: any = null;
  finishing = false;
  private readonly flipCleanup = new WeakMap<HTMLElement, (e: TransitionEvent) => void>();

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
    public queue: OfflineQueueService,
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

    // Kad red prođe, upisi dobijaju prave id-jeve iz baze — ekran se osvježava
    // da bi izmjena i brisanje serije radili nad stvarnim redovima.
    this.queue.onFlushed = () => { void this.reloadAfterSync(); };
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

    // Četiri nezavisna upita — paralelno, da ekran ne čeka lanac.
    const [logs, echo, bests, dropsetsByLog] = await Promise.all([
      this.trainingService.getSessionLogs(this.session.id),
      this.trainingService.getEcho(this.currentUserId, exerciceIds, this.todayDate),
      this.trainingService.getPersonalBests(this.currentUserId, exerciceIds, this.todayDate),
      this.trainingService.getSessionDropsets(this.session.id)
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
        saving: false,
        dropsets: (dropsetsByLog.get(l.id) ?? []).map(d => ({ ...d, deleting: false })),
        addingDropset: false,
        dropsetWeightInput: null,
        dropsetRepsInput: null,
        savingDropset: false
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
        showWeightInput: false,
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

    // Bodyweight vježbe: polje za kilažu je sakriveno dok korisnik eksplicitno
    // ne doda teg — OSIM ako je prošli put nešto dodavao, tada ostaje otkriveno.
    ex.showWeightInput = !ex.isBodyweight || (prev?.weight ?? 0) > 0;
  }

  /** Otkrivanje polja za dodatnu kilažu kod bodyweight vježbi. */
  revealWeightInput(ex: TodayExercice) {
    ex.showWeightInput = true;
  }

  async saveLog(ex: TodayExercice) {
    if (!this.session) return;

    const weight = ex.weightInput ?? (ex.isBodyweight ? 0 : null);
    if (ex.repsInput == null || weight == null || ex.saving) return;
    if (weight < 0 || weight > 1000) return;

    ex.saving = true;

    const setNumber = this.nextSetNumber(ex);
    const entry = {
      userId: this.currentUserId,
      sessionId: this.session.id,
      exerciceId: ex.exerciceId,
      planId: this.session.planId,
      date: this.todayDate,
      setNumber,
      reps: ex.repsInput,
      weight
    };

    const accept = (id: string, pending: boolean) => {
      ex.loggedSets.push({
        id,
        setNumber,
        reps: entry.reps,
        weight: entry.weight,
        ...this.compare(ex.echo, setNumber, entry.weight, entry.reps),
        pending,
        editing: false,
        editReps: null,
        editWeight: null,
        saving: false,
        dropsets: [],
        addingDropset: false,
        dropsetWeightInput: null,
        dropsetRepsInput: null,
        savingDropset: false
      });

      this.refreshPr(ex);
      ex.showLogForm = false;
      ex.repsInput = null;
      ex.weightInput = null;
    };

    // Bez mreže se ni ne pokušava — odmah u red, bez čekanja na istek veze.
    if (!navigator.onLine) {
      accept(this.queue.enqueue(entry).id, true);
      ex.saving = false;
      return;
    }

    try {
      const saved = await this.trainingService.logSet(entry);
      accept(saved.id, false);
    } catch (err: any) {
      // Samo pad MREŽE ide u red. Odbijanje od baze (npr. prekršeno pravilo)
      // bi se pri ponovnom slanju odbilo opet — takva greška mora da se vidi.
      if (this.isNetworkError(err)) {
        accept(this.queue.enqueue(entry).id, true);
      } else {
        this.errorMessage = humanError(err, 'Greška prilikom upisa rezultata.');
      }
    } finally {
      ex.saving = false;
    }
  }

  /** „1 upis čeka" / „2 upisa čekaju" / „5 upisa čeka" — brojivost, ne „1 upisa". */
  get pendingLabel(): string {
    const n = this.queue.pending;
    const last = n % 10, teen = n % 100;
    const word = (last === 1 && teen !== 11) ? 'upis' : 'upisa';
    const verb = (last === 1 && teen !== 11) ? 'čeka'
               : (last >= 2 && last <= 4 && (teen < 12 || teen > 14)) ? 'čekaju' : 'čeka';
    return `${n} ${word} ${verb} mrežu`;
  }

  /** Pad mreže se prepoznaje po poruci — Supabase klijent ne daje kod za to. */
  private isNetworkError(err: any): boolean {
    const msg = String(err?.message ?? err ?? '').toLowerCase();
    return !navigator.onLine
      || msg.includes('failed to fetch')
      || msg.includes('networkerror')
      || msg.includes('load failed');
  }

  startEditSet(set: LoggedSet) {
    if (set.pending) return;   // još nije u bazi — nema šta da se mijenja
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
  // Dropset — vezan za working seriju, ne ulazi u leaderboard/progres/PR.
  // -------------------------------------------------------------------------

  toggleDropsetForm(set: LoggedSet) {
    if (set.pending) return;   // još nije u bazi — nema na šta da se veže
    set.addingDropset = !set.addingDropset;
    set.dropsetWeightInput = null;
    set.dropsetRepsInput = null;
  }

  async saveDropset(set: LoggedSet) {
    if (set.dropsetRepsInput == null || set.dropsetWeightInput == null || set.savingDropset) return;
    if (set.dropsetWeightInput < 0 || set.dropsetWeightInput > 1000) return;

    set.savingDropset = true;

    try {
      const saved = await this.trainingService.logDropset({
        exerciceLogId: set.id,
        orderNum: set.dropsets.length + 1,
        reps: set.dropsetRepsInput,
        weight: set.dropsetWeightInput
      });

      set.dropsets.push({ ...saved, deleting: false });
      set.addingDropset = false;
      set.dropsetWeightInput = null;
      set.dropsetRepsInput = null;
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom upisa dropseta.');
    } finally {
      set.savingDropset = false;
    }
  }

  async deleteDropset(set: LoggedSet, dropset: DropsetEntry) {
    if (dropset.deleting) return;
    dropset.deleting = true;

    try {
      await this.trainingService.deleteDropset(dropset.id);
      set.dropsets = set.dropsets.filter(d => d.id !== dropset.id);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom brisanja dropseta.');
      dropset.deleting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Redoslijed vježbi
  // -------------------------------------------------------------------------

  ngOnDestroy() {
    this.queue.onFlushed = null;
    clearTimeout(this.saveTimer);
  }

  /** Klik na sam red poništava izbor; klik na strelice ne (one pomjeraju). */
  onRowClick(ex: TodayExercice) {
    if (!this.reordering) return;
    this.selectedId = this.selectedId === ex.id ? null : ex.id;
  }

  /** Klik bilo gdje van redova poništava izbor. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.reordering || !this.selectedId) return;
    if ((event.target as HTMLElement)?.closest('.exercice-row')) return;
    this.selectedId = null;
  }

  get isFinished(): boolean { return !!this.session?.finishedAt; }

  /**
   * Sažetak po završetku treninga.
   *
   * Namjerno NIJE statistika. Ukupna podignuta kilaža ne govori ništa korisno —
   * zavisi od toga koje su vježbe na redu, pa se ne može porediti ni sa čim.
   * Ovdje stoji odgovor na jedino pitanje koje se postavlja poslije treninga:
   * gdje sam napredovao, gdje sam stao, a gdje sam bio slabiji.
   */
  summary: {
    tone: 'record' | 'progress' | 'steady' | 'down' | 'plain';
    headline: string;
    line: string;
    records: { name: string; weight: number; previous: number | null }[];
    rows: { name: string; outcome: 'up' | 'same' | 'down'; detail: string }[];
  } | null = null;

  showSummary = false;

  private buildSummary() {
    const records: { name: string; weight: number; previous: number | null }[] = [];
    const rows: { name: string; outcome: 'up' | 'same' | 'down'; detail: string }[] = [];

    for (const ex of this.exercices) {
      if (ex.loggedSets.length === 0) continue;

      if (ex.isPr) {
        records.push({ name: ex.name, weight: this.todayBest(ex)!, previous: ex.previousBest });
        continue;   // rekord se prikazuje zasebno, ne i u spisku ishoda
      }

      const up = ex.loggedSets.filter(s => s.delta === 'up').length;
      const down = ex.loggedSets.filter(s => s.delta === 'down').length;
      const compared = ex.loggedSets.filter(s => s.delta !== null).length;
      if (compared === 0) continue;   // prvi put — nema se s čim porediti

      const outcome: 'up' | 'same' | 'down' = up > down ? 'up' : down > up ? 'down' : 'same';
      const detail =
        outcome === 'up'   ? `${up} ${up === 1 ? 'serija bolja' : 'serije bolje'}` :
        outcome === 'down' ? `${down} ${down === 1 ? 'serija slabija' : 'serije slabije'}` :
                             'isto kao prošli put';

      rows.push({ name: ex.name, outcome, detail });
    }

    const up = rows.filter(r => r.outcome === 'up').length;
    const same = rows.filter(r => r.outcome === 'same').length;
    const down = rows.filter(r => r.outcome === 'down').length;

    // Naslov bira NAJJAČU istinitu činjenicu, tim redom.
    let tone: 'record' | 'progress' | 'steady' | 'down' | 'plain' = 'plain';
    let headline = 'Trening upisan';
    let line = 'Nema ranijih rezultata za poređenje — od sljedećeg puta ih ima.';

    if (records.length > 0) {
      tone = 'record';
      headline = records.length === 1 ? 'Novi lični rekord' : `${records.length} nova rekorda`;
      line = 'Podigao si više nego ikad.';
    } else if (up > 0 && up >= down) {
      tone = 'progress';
      headline = 'Napredovao si';
      line = `Bolje na ${up} ${up === 1 ? 'vježbi' : 'vježbe'}` +
             (same ? `, isto na ${same}` : '') + (down ? `, slabije na ${down}` : '') + '.';
    } else if (down > 0 && down > up) {
      tone = 'down';
      headline = 'Težak dan';
      line = `Slabije na ${down} ${down === 1 ? 'vježbi' : 'vježbe'}. Dešava se — sljedeći put jače.`;
    } else if (same > 0) {
      tone = 'steady';
      headline = 'Održao si nivo';
      line = `Isto kao prošli put na ${same} ${same === 1 ? 'vježbi' : 'vježbe'}. I to je posao.`;
    }

    this.summary = { tone, headline, line, records, rows };
  }

  closeSummary() { this.showSummary = false; }

  /** Ukupno upisanih serija danas — prikazuje se uz oznaku da je trening gotov. */
  get totalSets(): number {
    return this.exercices.reduce((n, e) => n + e.loggedSets.length, 0);
  }

  async finishTraining() {
    if (!this.session || this.finishing) return;
    this.finishing = true;

    try {
      await this.trainingService.finishSession(this.session.id);
      this.session.finishedAt = new Date().toISOString();

      this.buildSummary();
      this.showSummary = true;
      this.exercices.forEach(e => { e.showLogForm = false; e.menuOpen = false; });
      if (this.summary?.tone === 'record') this.audio.play('record');
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom završetka treninga.');
    } finally {
      this.finishing = false;
    }
  }

  async reopenTraining() {
    if (!this.session || this.finishing) return;
    this.finishing = true;

    try {
      await this.trainingService.reopenSession(this.session.id);
      this.session.finishedAt = null;
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom otvaranja treninga.');
    } finally {
      this.finishing = false;
    }
  }

  toggleReorder() {
    this.reordering = !this.reordering;
    this.selectedId = null;
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
    const from = this.exercices.indexOf(ex);
    const to = from + direction;
    if (to < 0 || to >= this.exercices.length) return;

    const rows = this.rowEls.toArray().map(r => r.nativeElement);
    const movedEl = rows[from];
    const otherEl = rows[to];

    // FLIP: zapamti gdje su redovi BILI. getBoundingClientRect uračunava i
    // transformaciju u toku, pa uzastopni klikovi nastavljaju iz zatečenog
    // položaja umjesto da se trzaju.
    const movedFrom = movedEl?.getBoundingClientRect().top;
    const otherFrom = otherEl?.getBoundingClientRect().top;

    const list = [...this.exercices];
    [list[from], list[to]] = [list[to], list[from]];
    list.forEach((e, i) => e.orderNum = i + 1);   // brojevi odmah, ne nakon upisa
    this.exercices = list;

    this.selectedId = ex.id;

    if (movedEl && otherEl && movedFrom != null && otherFrom != null) {
      requestAnimationFrame(() => {
        const after = this.rowEls.toArray().map(r => r.nativeElement);
        const movedNow = after[to];
        const otherNow = after[from];
        if (!movedNow || !otherNow) return;

        // Pokret NADOLJE se percipira brže od pokreta nagore pri istom trajanju
        // — ide "niz gravitaciju". Zato spuštanje dobija više vremena, da oba
        // smjera djeluju jednako.
        const ms = direction === 1 ? 660 : 560;

        // Pomjerena ide PREKO druge: viši sloj, uvećana, sa sjenkom.
        this.flip(movedNow, movedFrom - movedNow.getBoundingClientRect().top, 1.05, 6, true, ms);
        this.flip(otherNow, otherFrom - otherNow.getBoundingClientRect().top, 0.965, 1, false, ms);
      });
    }

    // Upis se odgađa: pri brzom preređivanju nema smisla slati sedam izmjena
    // poslije svakog klika. Ekran je već tačan, baza sustiže kad se korisnik
    // smiri.
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persistOrder(), 600);
  }

  private async persistOrder() {
    if (!this.session) return;

    const snapshot = this.exercices.map((e, i) => ({ id: e.id, orderNum: i + 1 }));
    this.reorderSaving = true;

    try {
      await this.trainingService.setOrder(snapshot);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom promjene redoslijeda.');
      await this.hydrate();   // vrati ekran na ono što baza stvarno ima
    } finally {
      this.reorderSaving = false;
    }
  }

  /**
   * Jedan korak FLIP animacije nad jednim redom.
   *
   * Prethodni slušač se skida prije novog — inače bi kraj stare animacije
   * obrisao stilove usred nove i red bi zatreperio.
   */
  private flip(el: HTMLElement, dy: number, scale: number, z: number, lift: boolean, ms: number) {
    const prev = this.flipCleanup.get(el);
    if (prev) { el.removeEventListener('transitionend', prev); this.flipCleanup.delete(el); }

    el.style.transition = 'none';
    el.style.zIndex = String(z);
    el.style.transform = `translateY(${dy}px) scale(${scale})`;
    if (lift) el.style.boxShadow = 'var(--lift-3)';

    requestAnimationFrame(() => {
      // Sa prebačajem — da se pomak vidi i osjeti, a ne da samo škljocne.
      el.style.transition =
        `transform ${ms}ms cubic-bezier(0.2, 1.5, 0.35, 1), box-shadow ${ms}ms ease-out`;
      el.style.transform = 'translateY(0) scale(1)';
      el.style.boxShadow = '';

      const done = (e: TransitionEvent) => {
        if (e.propertyName !== 'transform') return;
        el.style.transition = '';
        el.style.zIndex = '';
        el.style.transform = '';
        el.removeEventListener('transitionend', done);
        this.flipCleanup.delete(el);
      };
      el.addEventListener('transitionend', done);
      this.flipCleanup.set(el, done);
    });
  }


  /** Bez ovoga Angular pri zamjeni pravi nove čvorove i animacija nema šta da pomjera. */
  trackById = (_: number, ex: TodayExercice) => ex.id;

  /** Vrati redoslijed na onaj iz plana — za slučaj da je sesija zastarjela. */
  async resetOrder() {
    if (!this.session || this.reorderSaving) return;

    // Otkaži odgođeni upis iz preuređivanja. Bez ovoga bi on završio POSLIJE
    // reseta i vratio stari raspored — trka koja se javi kad se "Vrati po planu"
    // pritisne ubrzo nakon pomjeranja.
    clearTimeout(this.saveTimer);

    this.reorderSaving = true;

    try {
      const plan = await this.trainingService.getPlanForUser(this.currentUserId);
      const day = (plan?.workout_days ?? []).find(
        (d: any) => d.name === this.session!.dayLabel
      );

      if (!day) {
        this.errorMessage = 'Plan nema taj dan, pa nema po čemu vratiti redoslijed.';
        return;
      }

      await this.trainingService.resetOrderToPlan(this.session.id, day.day_exercice ?? []);
      this.session = await this.trainingService.getOrCreateSession(
        this.currentUserId, this.todayDate, null
      );
      await this.hydrate();
      this.reordering = true;   // ostani u režimu da se vidi rezultat
      this.selectedId = null;
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom vraćanja redoslijeda.');
    } finally {
      this.reorderSaving = false;
    }
  }

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
  /** Ponovo učitava sesiju poslije sinhronizacije odloženih upisa. */
  private async reloadAfterSync() {
    if (!this.session) return;
    try {
      this.session = await this.trainingService.getOrCreateSession(
        this.currentUserId, this.todayDate, null
      );
      await this.hydrate();
    } catch {
      // Neuspjeh osvježavanja nije kritičan — upisi su prošli, ekran će se
      // uskladiti pri sljedećem otvaranju.
    }
  }

  toggleNote() {
    this.showNote = !this.showNote;
    if (this.showNote) this.noteText = this.session?.note ?? '';
  }

  async saveNote() {
    if (!this.session || this.noteSaving) return;
    this.noteSaving = true;

    try {
      await this.trainingService.saveNote(this.session.id, this.noteText);
      this.session.note = this.noteText.trim() || null;
      this.showNote = false;
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri upisu bilješke.');
    } finally {
      this.noteSaving = false;
    }
  }

  async openAdd() {
    this.swapTarget = null;
    this.swapMode = 'add';
    this.pickerSuggestedLabel = 'Za današnji dan';
    this.openPicker();

    try {
      const already = new Set(this.exercices.map(e => e.exerciceId));

      // "Za današnji dan" = vježbe koje dijele mišićnu grupu sa nečim što je
      // već u treningu. Izvedeno iz same sesije, pa radi i kad je vježba
      // zamijenjena ili ručno dodana.
      const [grouped, related] = await Promise.all([
        this.exerciceService.getExercicesGroupedByMuscleGroup(),
        this.trainingService.getRelatedToAll([...already])
      ]);

      this.pickerGroups = toPickerGroups(grouped, already);
      this.pickerSuggested = flattenGroups(this.pickerGroups).filter(o => related.has(o.id));
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju vježbi.');
    } finally {
      this.swapLoading = false;
    }
  }

  /** Zajednički početak za oba načina — modal se otvara prazan i puni se poslije. */
  private openPicker() {
    this.showSwapModal = true;
    this.swapLoading = true;
    this.pickerGroups = [];
    this.pickerSuggested = null;
    this.errorMessage = '';
    this.exercices.forEach(e => e.menuOpen = false);
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

    this.swapTarget = ex;
    this.swapMode = mode;
    this.pickerSuggestedLabel = 'Slične vježbe';
    this.openPicker();

    try {
      // Zamjena je ranije nudila SAMO vježbe iz iste mišićne grupe, kao ravnu
      // listu bez grupisanja. Ako tražena vježba nije bila među njima, nije se
      // imalo šta uraditi. Sada je uži izbor samo prvi opseg, a cijeli katalog
      // stoji uz njega — isto kao kod dodavanja.
      const already = new Set(
        this.exercices.filter(e => e.id !== ex.id).map(e => e.exerciceId)
      );
      already.add(ex.exerciceId);   // sama sebe ne mijenja

      const [alternatives, grouped] = await Promise.all([
        this.trainingService.getAlternatives(ex.exerciceId),
        this.exerciceService.getExercicesGroupedByMuscleGroup()
      ]);

      this.pickerGroups = toPickerGroups(grouped, already);
      this.pickerSuggested = alternatives.filter(o => !already.has(o.id));
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

  async confirmSwap(option: PickerOption) {
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
