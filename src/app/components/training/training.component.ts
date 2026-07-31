import { Component, ElementRef, HostListener, OnDestroy, DoCheck, OnInit, QueryList, ViewChildren } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ExerciceService } from '../../services/exercice.service';
import { AudioService } from '../../services/audio.service';
import { GlitchService } from '../../services/glitch.service';
import { OfflineQueueService } from '../../services/offline-queue.service';
import { NavLockService } from '../../services/nav-lock.service';
import { RestTimerService } from '../../services/rest-timer.service';
import {
  PickerGroup, PickerOption, toPickerGroups, flattenGroups
} from '../shared/exercice-picker/exercice-picker.component';
import { humanError } from '../../shared/errors';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TrainingService, WorkoutSession, SessionExercice, Echo, EchoSet, EchoDropset, Side
} from '../../services/training.service';
import { DropsetLog } from '../../models/models';
import { progressHaptics } from '../../shared/haptics';
import { LIVE_WINDOW_H, WARMUP_GRACE_MIN } from '../../shared/warmup-grace';

/** Poređenje jedne serije sa istom serijom prošlog treninga. */
type Delta = 'up' | 'down' | 'same' | null;

/** Dropset prikazan na ekranu — server podaci plus stanje izmjene i brisanja. */
interface DropsetEntry extends DropsetLog {
  deleting: boolean;
  editing?: boolean;
  editWeight?: number | null;
  editReps?: number | null;
  saving?: boolean;
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
  /** Strana kod jednoručnih vježbi; null = obje ruke zajedno. */
  side: Side;
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

  // --- Izvedena stanja: istina o tome kako je dan STVARNO rađen -------------
  //
  // `isUnilateral` i `isBodyweight` su GLOBALNI katalog-flagovi — pale se i
  // gase kroz meni, i to za sve korisnike odjednom. Istorija ne smije visjeti
  // o njima: dan odrađen dvoručno mora ostati dvoručan i pošto neko na toj
  // vježbi upali praćenje ruku. Istinu nose same serije — `side` kaže je li se
  // strana pratila, kilaža 0 da je serija odrađena tjelesnom težinom.

  /** Današnji upisi imaju bar jednu seriju sa stranom (L ili D). */
  dayHasSides: boolean;
  /** Današnji upisi imaju bar jednu seriju bez tega (kilaža 0). */
  dayHasBodyweight: boolean;
  /** Prošli trening je rađen po stranama — za duhove i poređenja. */
  echoHasSides: boolean;
  /**
   * Kratko stanje za animaciju prelaza rasporeda (jedan red ↔ dvije kolone).
   * CSS ne svira animaciju na uklanjanju klase, pa je vodi komponenta.
   */
  layoutFlow: boolean;

  /** Najbolja kilaža PRIJE današnjeg treninga. Prag za lični rekord. */
  previousBest: number | null;
  /**
   * Najviše ponavljanja odrađenih BEZ tega (weight = 0) prije današnjeg treninga.
   *
   * Prag za rekord kod čistih bodyweight vježbi: tamo kilaža uvijek stoji na 0,
   * pa se rekord ne može mjeriti njome — mjeri se brojem ponavljanja.
   */
  previousBestReps: number | null;
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
  /**
   * Da li je polje za kilažu rašireno.
   *
   * Kod vježbi bez tjelesne težine je uvijek `true` — kilaža je obavezna. Kod
   * bodyweight vježbi je to stanje čipa „BW": skupljeno polje znači čist BW (u
   * bazu ide 0), rašireno znači tjelesna težina PLUS teg.
   */
  showWeightInput: boolean;
  /**
   * Kratko stanje za animaciju prelaza između ta dva stanja — CSS ne svira
   * animaciju na uklanjanju klase, pa smjer vodi komponenta: „in" = polje se
   * razliva iz čipa, „out" = povlači se nazad u njega.
   */
  bwFlip: 'in' | 'out' | null;
  saving: boolean;
  menuOpen: boolean;
}

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss']
})
export class TrainingComponent implements OnInit, OnDestroy, DoCheck {
  loading = true;
  errorMessage = '';

  /** Redoslijed blokova kod jednoručnih vježbi. */
  readonly SIDES: Side[] = ['L', 'D'];

  session: WorkoutSession | null = null;
  todayDate = '';
  /**
   * Pregled RANIJEG dana (?date=YYYY-MM-DD): sve na ekranu je samo za čitanje.
   * `todayDate` tada nosi gledani datum, pa se duhovi, poređenja i rekord
   * računaju u odnosu na TAJ dan — kako je izgledalo tada, ne danas.
   */
  viewOnly = false;
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
  /** Traje koliko i animacija prelaza čipa „BW" — vidi `toggleBodyweightWeight`. */
  private bwFlipTimer: any = null;
  /** Traje koliko i razliv bloka serija pri promjeni rasporeda — `flowLayout`. */
  private layoutTimer: any = null;
  /** Kratko stanje za animaciju SKUPLJANJA tajmer-ostrva — CSS ne umije da
   *  odsvira animaciju na uklanjanju klase, pa je vodi komponenta. */
  tiClosing = false;
  private tiClosingTimer: any = null;
  /**
   * Sekundni otkucaj: osvježava natpis odbrojavanja (getter se računa tek pri
   * ciklusu provjere promjena) i PRATI FAZE tajmera, da bi svaki prelaz —
   * odbrojavanje → „pauza gotova" → povratak na minute — dobio svoju tečnu
   * animaciju. Pravilo kuće: nijedna promjena stanja bez pokreta.
   */
  tiFlashDone = false;
  tiReturn = false;
  private tiPhase: 'idle' | 'running' | 'done' = 'idle';
  private tiFlashTimer: any = null;
  private restTick: any = setInterval(() => this.watchTimerPhase(), 500);

  private watchTimerPhase() {
    const t = this.restTimer;
    const phase: 'idle' | 'running' | 'done' =
      !t.remainingLabel ? 'idle' : t.expired ? 'done' : 'running';
    if (phase === this.tiPhase) return;

    clearTimeout(this.tiFlashTimer);
    if (phase === 'done') {
      this.tiFlashDone = true;
      this.tiFlashTimer = setTimeout(() => this.tiFlashDone = false, 600);
    } else if (phase === 'idle' && this.tiPhase === 'done') {
      this.tiReturn = true;
      this.tiFlashTimer = setTimeout(() => this.tiReturn = false, 500);
    }
    this.tiPhase = phase;
  }
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
    private glitch: GlitchService,
    public queue: OfflineQueueService,
    private navLock: NavLockService,
    private router: Router,
    private route: ActivatedRoute,
    public restTimer: RestTimerService
  ) {}

  /**
   * Zaključava strelicu "nazad" u headeru dok je otvorena bilo koja edit
   * radnja — zamjena/dodavanje vježbe, preuređivanje, bilješka, ciljevi — da
   * se ne izađe slučajno usred nedovršene izmjene. Provjerava se pri svakom
   * ciklusu provjere promjena umjesto da se poziva na svakom mjestu koje
   * otvara/zatvara neki od ovih modova, da se ne zaboravi nijedan.
   */
  ngDoCheck() {
    this.navLock.locked = this.showSwapModal || this.reordering || this.showNote || this.showTargetModal;
  }

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.errorMessage = 'Nisi ulogovan.';
      this.loading = false;
      return;
    }

    this.currentUserId = user.id;

    const dateParam = this.route.snapshot.queryParamMap.get('date');
    this.viewOnly = !!dateParam && dateParam !== this.todayString();
    this.todayDate = this.viewOnly ? dateParam! : this.todayString();

    // Kad red prođe, upisi dobijaju prave id-jeve iz baze — ekran se osvježava
    // da bi izmjena i brisanje serije radili nad stvarnim redovima. U pregledu
    // istorije se NE kači: osvježavanje bi napravilo sesiju za gledani datum.
    if (!this.viewOnly) {
      this.queue.onFlushed = () => { void this.reloadAfterSync(); };
    }

    try {
      if (this.viewOnly) {
        this.session = await this.trainingService.getSessionByDate(user.id, this.todayDate);
        if (!this.session) {
          this.errorMessage = 'Tog dana nije bilo treninga.';
          return;
        }
      } else {
        const plan = await this.trainingService.getPlanForUser(user.id);
        this.session = await this.trainingService.getOrCreateSession(user.id, this.todayDate, plan);

        if (!this.session) {
          this.errorMessage = plan
            ? 'Nema definisanog rasporeda za danas.'
            : 'Nemaš plan koji pratiš. Napravi ga ili zaprati tuđi na ekranu Planovi.';
          return;
        }
      }

      await this.hydrate();

      // Poslije hydrate-a, jer odluka zavisi od upisanih serija.
      await this.restartClockIfStale();
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri učitavanju treninga.');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Pošten sat treninga pri ulasku na ekran.
   *
   * `started_at` nastane `default now()` već pri PRVOM otvaranju ekrana za taj
   * datum — i jučerašnje listanje rasporeda ostavi pečat od juče, koji onda
   * truje tajmer i „trenira sada". Zato: ako trening tek počinje (nijedna
   * upisana serija) a sat je stariji od WARMUP_GRACE_MIN minuta, vraća se na
   * sada — tajmer broji od stvarnog dolaska u teretanu, zagrijavanje uključeno.
   *
   * Tiho na grešci: sat je ukras, ne smije oboriti učitavanje ekrana.
   */
  private async restartClockIfStale(): Promise<void> {
    const s = this.session;
    if (!s || this.viewOnly || s.finishedAt || !s.startedAt) return;
    if (this.exercices.some(e => e.loggedSets.length > 0)) return;

    const ageMs = Date.now() - new Date(s.startedAt).getTime();
    if (ageMs < WARMUP_GRACE_MIN * 60_000) return;

    try {
      const now = new Date().toISOString();
      await this.trainingService.restartSessionClock(s.id);
      s.startedAt = now;
    } catch {
      // Bez sata se i dalje normalno trenira.
    }
  }

  /** Napuni ekran: vježbe iz sesije + upisane serije + echo + rekordi. */
  private async hydrate() {
    if (!this.session) return;

    const exerciceIds = this.session.exercices.map(e => e.exerciceId);
    this.isRestDay = exerciceIds.length === 0;

    // Pet nezavisnih upita — paralelno, da ekran ne čeka lanac.
    const [logs, echo, bests, bwBests, dropsetsByLog] = await Promise.all([
      this.trainingService.getSessionLogs(this.session.id),
      this.trainingService.getEcho(this.currentUserId, exerciceIds, this.todayDate),
      this.trainingService.getPersonalBests(this.currentUserId, exerciceIds, this.todayDate),
      this.trainingService.getBodyweightBests(this.currentUserId, exerciceIds, this.todayDate),
      this.trainingService.getSessionDropsets(this.session.id)
    ]);

    this.exercices = this.session.exercices.map(se => {
      const own = logs.filter(l => l.exercice_id === se.exerciceId);
      const ec = echo.get(se.exerciceId) ?? null;
      const previousBest = bests.get(se.exerciceId) ?? null;
      const previousBestReps = bwBests.get(se.exerciceId) ?? null;

      const sets: LoggedSet[] = own.map(l => ({
        id: l.id,
        setNumber: l.set_number,
        reps: l.reps,
        weight: l.weight,
        side: l.side ?? null,
        ...this.compare(ec, l.set_number, l.weight, l.reps, l.side ?? null),
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

      const isPr = this.hasPr(sets, previousBest, previousBestReps);

      // Mjera rekorda je kilaža, a kod čistog bodyweighta broj ponavljanja —
      // ista logika kao u `prMetric`, samo prije nego što vježba postoji.
      const bestWeight = sets.length ? Math.max(...sets.map(s => s.weight)) : 0;
      const bestReps = sets.length ? Math.max(...sets.map(s => s.reps)) : 0;

      return {
        ...se,
        echo: ec,
        // Izvedeno IZ PODATAKA, ne iz katalog-flaga — vidi `splitLayout`.
        dayHasSides: sets.some(s => s.side !== null),
        dayHasBodyweight: sets.some(s => s.weight === 0),
        echoHasSides: (ec?.sets ?? []).some(s => s.side !== null),
        layoutFlow: false,
        previousBest,
        previousBestReps,
        isPr,
        // Zatečeni rekord se NE slavi pri učitavanju ekrana — samo onaj koji
        // padne pred korisnikom.
        prShown: isPr ? (bestWeight > 0 ? bestWeight : bestReps) : null,
        celebrating: false,
        celebrateKey: 0,
        loggedSets: sets,
        showLogForm: false,
        repsInput: null,
        weightInput: null,
        // Bez tjelesne težine kilaža je obavezna, pa je polje uvijek rašireno.
        showWeightInput: !se.isBodyweight,
        bwFlip: null,
        saving: false,
        menuOpen: false
      };
    });
  }

  // -------------------------------------------------------------------------
  // Izvedena stanja — raspored i bedževi se crtaju po PODACIMA, ne po flagu
  // -------------------------------------------------------------------------

  /**
   * Osvježi izvedena stanja dana. Zove se iz SVAKE radnje koja mijenja serije
   * (upis, izmjena, brisanje) i iz paljenja/gašenja flagova — raspored,
   * bedževi i brojanje se crtaju po njima, pa moraju pratiti podatke u istom
   * trenutku, bez ponovnog učitavanja ekrana.
   */
  private refreshDerived(ex: TodayExercice) {
    ex.dayHasSides = ex.loggedSets.some(s => s.side !== null);
    ex.dayHasBodyweight = ex.loggedSets.some(s => s.weight === 0);
  }

  /**
   * JEDINI izvor istine o rasporedu serija: dvije kolone (L/D) ili jedan red.
   *
   * U istoriji i na završenom treningu ISKLJUČIVO po podacima: dan bez ijedne
   * serije sa stranom bio je dvoručan, ma šta katalog danas tvrdio. Bez ovoga
   * bi paljenje L/D na vježbi retroaktivno pocijepalo svaki raniji dan u dvije
   * prazne kolone pune duhova.
   *
   * Na ŽIVOM treningu flag ima pravo glasa: tek upaljen, još bez ijedne serije,
   * mora odmah ponuditi dvije kolone — inače se ne bi imalo gdje upisati.
   */
  splitLayout(ex: TodayExercice): boolean {
    return this.isFinished ? ex.dayHasSides : (ex.dayHasSides || ex.isUnilateral);
  }

  /**
   * Bedž „L·D": u istoriji govori kako je dan RAĐEN, na živom treningu kako se
   * vježba prati od sada. Isto pravilo kao raspored.
   */
  showSidesBadge(ex: TodayExercice): boolean {
    return this.isFinished ? ex.dayHasSides : ex.isUnilateral;
  }

  /** Bedž „BW": u istoriji po tragu u danu (kilaža 0), na živom po flagu. */
  showBwBadge(ex: TodayExercice): boolean {
    return this.isFinished ? ex.dayHasBodyweight : ex.isBodyweight;
  }

  /**
   * Opis uz datum prošlog treninga.
   *
   * Kad prošli dan nije rađen istim rasporedom kao današnji, duh ne dolazi iz
   * jednog reda — treba reći odakle dolazi, inače brojka u duhu izgleda kao da
   * je iz vazduha.
   */
  echoHint(ex: TodayExercice): string {
    if (ex.echoHasSides && !this.splitLayout(ex)) {
      return 'Prošli put rađeno po stranama — duh pokazuje slabiju stranu';
    }
    if (!ex.echoHasSides && this.splitLayout(ex)) {
      return 'Prošli put rađeno objema — isti duh važi za obje strane';
    }
    return 'Prošli trening ove vježbe';
  }

  /**
   * Da li se polje kilaže ponaša kao bodyweight — prazno polje znači 0.
   *
   * Ne gleda samo flag vježbe nego i SAM RED: kilaža 0 jeste trag da je serija
   * odrađena tjelesnom težinom, pa se takav red i pošto se flag ugasi otvara
   * prazan, sa duhom „BW", a prazno polje mu čuva nulu umjesto da tiho odbije
   * izmjenu. Kod vježbi koje se ne rade tjelesnom težinom nula se praktično ne
   * javlja, a i kad se javi — tretman je isti i tačan.
   */
  bwField(ex: TodayExercice, weight: number): boolean {
    return ex.isBodyweight || weight === 0;
  }

  /**
   * PRAVILO SLABIJE STRANE.
   *
   * Kad se današnja DVORUČNA serija poredi sa danom rađenim po stranama, nema
   * jednog reda za poređenje nego dva. Uzima se slabiji: manja kilaža, a pri
   * istoj kilaži manje ponavljanja.
   *
   * Zašto slabiji: duh je cilj koji treba dostići, a poređenje presuda. Jača
   * ruka nije mjera dvoručne serije (10kg po ruci nije 10kg sa obje), pa bi po
   * njoj svaki dvoručni dan ispao nazadak. Slabija strana je ono što je sigurno
   * odrađeno — presuda ostaje poštena, a cilj dostižan.
   */
  private weakerSet(a: EchoSet, b: EchoSet): EchoSet {
    if (a.weight !== b.weight) return a.weight < b.weight ? a : b;
    return a.reps <= b.reps ? a : b;
  }

  /**
   * Duh/referenca prošlog treninga za jednu seriju i jednu stranu.
   *
   * Jedno mjesto za oba nesimetrična slučaja:
   *   • danas L/D, prošlost dvoručna — dvoručni red važi za OBJE ruke
   *     (10kg × 12 sa obje bučice jeste 10kg po ruci),
   *   • danas dvoručno, prošlost L/D — svodi se na slabiju stranu.
   *
   * Ranije je drugi smjer nigdje nije bio pokriven, pa je dan poslije gašenja
   * L/D ostajao bez ijednog duha i bez ijedne strelice.
   */
  private echoSetIn(echo: Echo | null, setNumber: number, side: Side): EchoSet | null {
    const rows = (echo?.sets ?? []).filter(s => s.setNumber === setNumber);
    if (rows.length === 0) return null;

    // Ista strana sa istom stranom.
    const exact = rows.find(s => s.side === side);
    if (exact) return exact;

    // Tražena je strana, prošlost dvoručna.
    if (side !== null) return rows.find(s => s.side === null) ?? null;

    // Tražena je dvoručna serija, prošlost po stranama — slabija strana.
    const sided = rows.filter(s => s.side !== null);
    return sided.length > 0 ? sided.reduce((a, b) => this.weakerSet(a, b)) : null;
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
  private compare(echo: Echo | null, setNumber: number, weight: number, reps: number, side: Side = null): {
    delta: Delta; weightDelta: Delta; repsDelta: Delta; prevLabel: string | null;
  } {
    // Strana se bira po `echoSetIn` — ista strana ako je ima, inače prošli
    // dvoručni red (važi za obje ruke) ili slabija strana (vidi pravilo
    // slabije strane).
    const prev = this.echoSetIn(echo, setNumber, side);
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
      // Kilaža 0 znači čistu tjelesnu težinu — „0kg × 8" ne govori ništa.
      prevLabel: `Prošli put: ${prev.weight > 0 ? prev.weight + 'kg' : 'BW'} × ${prev.reps}`
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
  private hasPr(
    sets: LoggedSet[], previousBest: number | null, previousBestReps: number | null
  ): boolean {
    if (sets.length === 0 || previousBest === null) return false;

    const best = Math.max(...sets.map(s => s.weight));
    if (best > previousBest) return true;

    // Današnji dan je odrađen bez tega (zgibovi, sklekovi): kilaža stoji na 0,
    // pa se po njoj rekord nikad ne bi mogao oboriti — mjeri se broj
    // ponavljanja, u odnosu na najviše ranije odrađenih BEZ tega.
    //
    // NE traži se da je i ranije SVE bilo bez tega: ko je vježbu prije radio i
    // sa tegom imao je prag `previousBest > 0`, pa je stari uslov
    // `previousBest === 0` gutao svaki rekord po ponavljanjima. Bez ijednog
    // ranijeg upisa bez tega (prag null) rekorda i dalje nema — prvi put nije
    // dostignuće.
    if (best === 0 && previousBestReps !== null) {
      return Math.max(...sets.map(s => s.reps)) > previousBestReps;
    }

    return false;
  }

  /**
   * Vrijednost i jedinica po kojoj se mjeri rekord ove vježbe.
   *
   * Kod čiste bodyweight vježbe to nisu kilogrami nego ponavljanja — inače bi
   * oznaka rekorda glasila „0kg".
   */
  prMetric(ex: TodayExercice): { value: number; previous: number | null; unit: string } {
    const weight = this.todayBest(ex) ?? 0;
    if (weight > 0) return { value: weight, previous: ex.previousBest, unit: 'kg' };

    return {
      value: ex.loggedSets.length ? Math.max(...ex.loggedSets.map(s => s.reps)) : 0,
      previous: ex.previousBestReps,
      unit: 'pon.'
    };
  }

  /** Opis uz oznaku rekorda — u istoj jedinici u kojoj se rekord i mjeri. */
  prTitle(ex: TodayExercice): string {
    const m = this.prMetric(ex);
    if (m.previous === null) return 'Novi lični rekord';
    return `Novi lični rekord — prošli najbolji ${m.previous}${m.unit === 'kg' ? 'kg' : ' pon.'}`;
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
    ex.isPr = this.hasPr(ex.loggedSets, ex.previousBest, ex.previousBestReps);

    if (!ex.isPr) {
      ex.prShown = null;
      return;
    }

    // Ne kilaža nego MJERA rekorda: kod čistog bodyweighta to su ponavljanja,
    // pa se plamen ponovi i kad rekord naraste sa 10 na 12 zgibova.
    const metric = this.prMetric(ex);
    const best = metric.value;
    if (ex.prShown !== null && best <= ex.prShown) return;

    ex.prShown = best;
    ex.celebrateKey = Date.now();
    ex.celebrating = true;
    this.audio.play('record');
    progressHaptics('record');   // najjača vibracija — uz plamen (gdje uređaj umije)
    // Zlatni glitch preko cijelog ekrana, sa porukom u MJERI rekorda (kilaža,
    // a kod čistog bodyweighta ponavljanja) — udara u istom taktu sa plamenom.
    this.glitch.trigger('gold',
      `NOVI REKORD · ${best} ${metric.unit === 'kg' ? 'kg' : 'pon.'}`);
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

  /**
   * Prošli trening za seriju koju korisnik upravo upisuje.
   *
   * Strana se traži po rasporedu kojim se DANAS upisuje: u dvije kolone jedan
   * unos puni obje ruke, pa se predlaže lijeva; u jednom redu se traži prošla
   * dvoručna serija. Ranije je dvoručna grana uzimala „prvi red iz niza" — kad
   * je prošli dan bio L/D, prijedlog je zavisio od redoslijeda redova iz baze.
   */
  echoFor(ex: TodayExercice, setNumber: number): EchoSet | null {
    return this.echoSetIn(ex.echo, setNumber, this.splitLayout(ex) ? 'L' : null);
  }

  /** Serije jedne strane; null = dvoručne. */
  setsFor(ex: TodayExercice, side: Side): LoggedSet[] {
    return ex.loggedSets.filter(s => s.side === side);
  }

  /**
   * JEDNO PRAVILO BROJANJA: serija je jedan `set_number`, ne jedan red u bazi.
   *
   * Kod jednoručne vježbe su par L+D dva reda a JEDNA odrađena serija. Pošto se
   * praćenje ruku pali i gasi usred dana, dan zna imati i dvoručnih i
   * jednoručnih redova — brojanje različitih rednih brojeva pokriva sve te
   * slučajeve istim pravilom. Ranije se brojalo čas po redovima čas po jačoj
   * strani, pa je gašenje flaga udvostručavalo brojač, a paljenje ga zamrzavalo.
   *
   * Isti ključ (vježba, redni broj) broji serije i na rang listi
   * (`LeaderboardService.getLiveSessions`) i u kalendaru profila.
   */
  private setNumbers(ex: TodayExercice): number[] {
    return [...new Set(ex.loggedSets.map(s => s.setNumber))].sort((a, b) => a - b);
  }

  doneCount(ex: TodayExercice): number {
    return new Set(ex.loggedSets.map(s => s.setNumber)).size;
  }

  /**
   * Redni broj sljedeće serije = NAJVEĆI upisani + 1, preko svih redova.
   *
   * Namjerno ne „broj odrađenih + 1": kad se L/D upali usred dana, tri ranije
   * dvoručne serije daju brojku 3, pa bi svaka naredna serija zauvijek bila
   * „4" i upisivala duplikat istog rednog broja. Po najvećem broju numeracija
   * uvijek ide dalje, a poslije gašenja flaga ne pravi rupu.
   */
  nextSetNumber(ex: TodayExercice): number {
    return ex.loggedSets.reduce((max, s) => Math.max(max, s.setNumber), 0) + 1;
  }

  /**
   * Duhovi serija za jednu stranu bloka.
   *
   * Duh se traži za SVAKI redni broj iz prošlog treninga, preko `echoSetIn` —
   * pa rade oba nesimetrična slučaja: prošli dvoručni dan daje iste duhove u
   * obje kolone, a prošli L/D dan daje duhove i u dvoručnom redu (slabija
   * strana). Skriva se onoliko sa početka koliko ta strana danas ima upisano.
   */
  sideGhosts(ex: TodayExercice, side: Side): EchoSet[] {
    const done = this.setsFor(ex, side).length;

    return [...new Set((ex.echo?.sets ?? []).map(g => g.setNumber))]
      .sort((a, b) => a - b)
      .filter(n => n > done)
      .map(n => this.echoSetIn(ex.echo, n, side))
      .filter((g): g is EchoSet => g !== null);
  }

  /** Pali/gasi praćenje ruku odvojeno — trajno, na nivou vježbe. */
  async toggleUnilateral(ex: TodayExercice) {
    ex.menuOpen = false;
    const value = !ex.isUnilateral;
    try {
      await this.trainingService.setUnilateral(ex.exerciceId, value);
      ex.isUnilateral = value;
      // Raspored se crta po izvedenom stanju — osvježi ga odmah i pusti da se
      // prelaz vidi. Numeracija po najvećem rednom broju čini promjenu usred
      // dana bezbjednom: ni duplikata ni rupe.
      this.refreshDerived(ex);
      this.flowLayout(ex);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri promjeni praćenja ruku.');
    }
  }

  /**
   * Prelaz rasporeda serija (jedan red ↔ dvije kolone) mora imati pokret —
   * kućno pravilo: nijedan trenutni preskok. Blok se razlije po širini dok se
   * stisne po visini pa slegne, a kap akcenta pređe preko njega. CSS ne svira
   * animaciju na uklanjanju klase, pa kratko stanje vodi komponenta.
   */
  private flowLayout(ex: TodayExercice) {
    clearTimeout(this.layoutTimer);
    this.exercices.forEach(e => e.layoutFlow = false);

    // Sljedeći takt: klasa se prvo stvarno skine pa opet doda, inače pregledač
    // vidi isto stanje i animacija se ne odsvira ponovo.
    setTimeout(() => {
      ex.layoutFlow = true;
      this.layoutTimer = setTimeout(() => ex.layoutFlow = false, 560);
    });
  }

  /**
   * Pali/gasi tjelesnu težinu kao osnovu vježbe — trajno, na nivou vježbe.
   *
   * Isto kao praćenje ruku: katalog vježbi je zajednički, pa ko jednom kaže da
   * su zgibovi bodyweight, takvi su svima. Bez ovoga se BW opcija mogla dobiti
   * samo ako je vježba već u bazi bila označena.
   */
  async toggleBodyweight(ex: TodayExercice) {
    ex.menuOpen = false;
    const value = !ex.isBodyweight;
    try {
      await this.trainingService.setBodyweight(ex.exerciceId, value);
      ex.isBodyweight = value;
      // Bez tjelesne težine kilaža je opet obavezna — polje mora ostati otvoreno.
      if (!value) ex.showWeightInput = true;
      // Bedž „BW" u istoriji stoji po tragu u danu (kilaža 0), pa se izvedeno
      // stanje osvježava i ovdje — već upisane serije bez tega ostaju BW.
      this.refreshDerived(ex);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška pri promjeni tjelesne težine.');
    }
  }

  /**
   * Dropsetovi prošlog treninga koji danas još nisu ponovljeni.
   *
   * Prikazuju se blijedo, uz seriju kojoj su pripadali — isto kao što se duh
   * serije prikazuje uz polje za upis. Bez ovoga se prošli dropset nije vidio
   * nigdje, pa se u toku treninga nije imalo prema čemu raditi.
   *
   * Odbacuje se onoliko sa početka koliko je danas već upisano: kad se upiše
   * prvi dropset, on staje na mjesto prvog duha, a ostali duhovi ostaju.
   */
  ghostDropsets(ex: TodayExercice, set: LoggedSet): EchoDropset[] {
    // Duh dropseta dolazi sa iste strane kao serija, po istom pravilu kao duh
    // serije: prošli dvoručni red važi za obje ruke, a prošli L/D par se za
    // današnju dvoručnu seriju svodi na slabiju stranu.
    const prev = this.echoSetIn(ex.echo, set.setNumber, set.side)?.dropsets ?? [];
    const done = set.dropsets.length;
    return done >= prev.length ? [] : prev.slice(done);
  }

  /** Tekst u polju prije nego što korisnik išta ukuca. */
  echoPlaceholder(ex: TodayExercice, field: 'reps' | 'weight'): string {
    const prev = this.echoFor(ex, this.nextSetNumber(ex));
    if (!prev) return field === 'reps' ? 'Ponavljanja' : 'Kilaža';
    if (field === 'reps') return `${prev.reps}`;
    // Prošli put bez tega — nula kao duh bi zvučala kao prijedlog da se upiše 0.
    return prev.weight > 0 ? `${prev.weight}` : 'Kilaža';
  }

  /** Koliko je serija plan predvidio, a koliko ih je odrađeno. */
  progressLabel(ex: TodayExercice): string {
    const done = this.doneCount(ex);
    return ex.targetSets ? `${done}/${ex.targetSets}` : `${done}`;
  }

  isComplete(ex: TodayExercice): boolean {
    return !!ex.targetSets && this.doneCount(ex) >= ex.targetSets;
  }

  // -------------------------------------------------------------------------
  // Upis serije
  // -------------------------------------------------------------------------

  toggleLogForm(ex: TodayExercice) {
    ex.showLogForm = !ex.showLogForm;
    ex.menuOpen = false;
    ex.bwFlip = null;

    // Predloži prošli rezultat kao polaznu vrijednost — u teretani se najčešće
    // ponavlja isto ili se dodaje mali korak.
    const prev = this.echoFor(ex, this.nextSetNumber(ex));

    // Bodyweight vježba se otvara u stanju „čist BW" — osim ako je prošli put
    // stvarno bilo tega, tada se polje otvara sa tom kilažom. Ranije je prefil
    // upisivao i nulu, pa se morala brisati rukom prije svake serije.
    const withWeight = !ex.isBodyweight || (prev?.weight ?? 0) > 0;

    ex.repsInput = ex.showLogForm ? prev?.reps ?? null : null;
    ex.weightInput = (ex.showLogForm && withWeight) ? prev?.weight ?? null : null;
    ex.showWeightInput = withWeight;
  }

  /**
   * Čip „BW": prebacuje bodyweight vježbu između „čistog BW" i „BW + teg",
   * u OBA smjera.
   *
   * Povratak na čist BW briše upisanu kilažu — inače bi prefilovani teg tiho
   * završio u bazi iako je čip kaže da ga nema. Kratko stanje `bwFlip` nosi
   * smjer animacije: CSS ne umije da odsvira prelaz na uklanjanju klase.
   */
  toggleBodyweightWeight(ex: TodayExercice) {
    const opening = !ex.showWeightInput;
    ex.showWeightInput = opening;

    if (opening) {
      const prev = this.echoFor(ex, this.nextSetNumber(ex));
      ex.weightInput = (prev?.weight ?? 0) > 0 ? prev!.weight : null;
    } else {
      ex.weightInput = null;
    }

    this.exercices.forEach(e => e.bwFlip = null);
    ex.bwFlip = opening ? 'in' : 'out';
    clearTimeout(this.bwFlipTimer);
    this.bwFlipTimer = setTimeout(() => ex.bwFlip = null, 560);
  }

  async saveLog(ex: TodayExercice) {
    if (!this.session) return;

    const weight = ex.weightInput ?? (ex.isBodyweight ? 0 : null);
    if (ex.repsInput == null || weight == null || ex.saving) return;
    if (weight < 0 || weight > 1000) return;

    ex.saving = true;

    const setNumber = this.nextSetNumber(ex);

    // Jednoručna vježba: jedan unos pravi DVIJE serije, L pa D, sa istim
    // brojevima. Uvijek se odradi i druga ruka, pa je odvojen upis za nju samo
    // kucanje istog dvaput; ako je desna ipak uradila drugačije, dodirne se
    // njena pilula i ispravi.
    const sides: Side[] = ex.isUnilateral ? ['L', 'D'] : [null];

    // Vrijednosti se hvataju ODMAH: `accept` isprazni polja forme poslije prve
    // strane, pa bi upis za desnu ruku pročitao null iz očišćene forme.
    const reps = ex.repsInput;

    const mkEntry = (side: Side) => ({
      userId: this.currentUserId,
      sessionId: this.session!.id,
      exerciceId: ex.exerciceId,
      planId: this.session!.planId,
      date: this.todayDate,
      setNumber,
      reps,
      weight,
      side
    });
    const entry = mkEntry(sides[0]);

    // Vibracija po veličini trenutka, JEDNOM po upisu (ne po strani): rekord
    // dobija svoju najjaču u refreshPr (uz plamen); bez rekorda — veća kilaža
    // od prošlog puta srednju, više ponavljanja kratku. Poređenje se računa
    // unaprijed jer `accept` čisti formu.
    const cmp = this.compare(ex.echo, setNumber, weight, reps, sides[0]);
    // Ista prošla serija po kojoj je cmp presudio — za poruku glitcha treba i
    // SAMA razlika, ne samo smjer. Hvata se prije `accept`-a, jer on čisti formu.
    const prevSet = this.echoSetIn(ex.echo, setNumber, sides[0]);
    const buzzProgress = () => {
      if (ex.celebrating) return;   // rekord je već odsvirao jaču
      if (cmp.weightDelta === 'up') {
        // Kilaža je porasla: vibracija + volt glitch preko ekrana sa porukom
        // koliko je skočilo + (zvuk kad snimak stigne) — jedan sinhron
        // trenutak. Samo za kilažu, ne za ponavljanja: glitch je registar
        // moći, ne svakodnevni šum. Razlika na pola kile, zapeta po kućnom
        // pravopisu („+2,5 kg").
        const diff = Math.round((weight - (prevSet?.weight ?? 0)) * 2) / 2;
        progressHaptics('weight');
        this.glitch.trigger('volt', `+${String(diff).replace('.', ',')} kg`);
        void this.audio.play('glitch');
      } else if (cmp.repsDelta === 'up') progressHaptics('reps');
    };

    const accept = (id: string, pending: boolean, side: Side = sides[0]) => {
      ex.loggedSets.push({
        id,
        setNumber,
        reps: entry.reps,
        weight: entry.weight,
        side,
        ...this.compare(ex.echo, setNumber, entry.weight, entry.reps, side),
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
      // Prva serija sa stranom pretvara raspored u dvije kolone, prva bez tega
      // pali bedž „BW" — izvedena stanja moraju pratiti upis odmah.
      this.refreshDerived(ex);
      ex.showLogForm = false;
      ex.repsInput = null;
      ex.weightInput = null;
    };

    // Bez mreže se ni ne pokušava — odmah u red, bez čekanja na istek veze.
    if (!navigator.onLine) {
      sides.forEach(side => accept(this.queue.enqueue(mkEntry(side)).id, true, side));
      buzzProgress();
      this.restTimer.restart();
      ex.saving = false;
      return;
    }

    try {
      for (const side of sides) {
        const saved = await this.trainingService.logSet(mkEntry(side));
        accept(saved.id, false, side);
      }
      buzzProgress();
      this.restTimer.restart();
    } catch (err: any) {
      // Samo pad MREŽE ide u red. Odbijanje od baze (npr. prekršeno pravilo)
      // bi se pri ponovnom slanju odbilo opet — takva greška mora da se vidi.
      if (this.isNetworkError(err)) {
        // U red idu SVE strane koje još nisu prošle — da par ne ostane šepav.
        const done = ex.loggedSets.filter(s => s.setNumber === setNumber).map(s => s.side);
        sides.filter(side => !done.includes(side))
             .forEach(side => accept(this.queue.enqueue(mkEntry(side)).id, true, side));
        this.restTimer.restart();
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

  startEditSet(ex: TodayExercice, set: LoggedSet) {
    if (set.pending) return;   // još nije u bazi — nema šta da se mijenja
    set.editing = true;
    set.editReps = set.reps;
    // Kilaža 0 znači „bez tega" — polje se otvara prazno, da se nula ne mora
    // brisati rukom prije nego što se teg upiše. Vrijedi i kad je flag vježbe
    // u međuvremenu ugašen: red koji JESTE bio bodyweight ostaje BW-tretiran.
    set.editWeight = this.bwField(ex, set.weight) ? null : set.weight;
  }

  cancelEditSet(set: LoggedSet) {
    set.editing = false;
  }

  async saveEditSet(ex: TodayExercice, set: LoggedSet) {
    // Prazno polje na bodyweight redu je 0, isto kao pri upisu serije — inače
    // bi dugme „sačuvaj" tiho ne radilo ništa. Gleda se i sam red (`bwField`),
    // pa serija odrađena bez tega ostaje izmjenjiva i poslije gašenja flaga.
    const weight = set.editWeight ?? (this.bwField(ex, set.weight) ? 0 : null);
    if (set.editReps == null || weight == null || set.saving) return;
    if (weight < 0 || weight > 1000) return;

    set.saving = true;

    try {
      const updated = await this.trainingService.updateLog(set.id, set.editReps, weight);
      set.reps = updated.reps;
      set.weight = updated.weight;
      Object.assign(set, this.compare(ex.echo, set.setNumber, set.weight, set.reps, set.side));
      set.editing = false;

      // Izmjena može i stvoriti i poništiti rekord — zato ista provjera kao
      // pri upisu, uključujući i animaciju. Kilaža 0 ↔ teg mijenja i bedž „BW".
      this.refreshPr(ex);
      this.refreshDerived(ex);
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

      // Prenumeracija UNUTAR strane sa koje je obrisano: L i D teku odvojeno,
      // pa brisanje L2 ne smije pomjeriti D3. Kod dvoručnih je strana null i
      // ovo je isti posao kao i ranije.
      const sameSide = ex.loggedSets.filter(s => s.side === set.side);
      for (let i = 0; i < sameSide.length; i++) {
        const wanted = i + 1;
        if (sameSide[i].setNumber !== wanted) {
          await this.trainingService.renumberSet(sameSide[i].id, wanted);
          sameSide[i].setNumber = wanted;
          Object.assign(sameSide[i], this.compare(
            ex.echo, wanted, sameSide[i].weight, sameSide[i].reps, sameSide[i].side
          ));
        }
      }

      this.refreshPr(ex);
      // Brisanje posljednje serije sa stranom vraća dan u dvoručni raspored —
      // izvedeno stanje mora pasti zajedno sa podatkom.
      const wasSplit = this.splitLayout(ex);
      this.refreshDerived(ex);
      if (wasSplit !== this.splitLayout(ex)) this.flowLayout(ex);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom brisanja serije.');
      set.saving = false;
    }
  }

  // -------------------------------------------------------------------------
  // Dropset — vezan za working seriju, ne ulazi u leaderboard/progres/PR.
  // -------------------------------------------------------------------------

  /**
   * Otvaranje unosa dropseta — iz reda za izmjenu serije, ne iz stalnog dugmeta.
   *
   * Ranije je ispod SVAKE upisane serije stajalo dugme „+ Dropset". Sa tri
   * serije to su tri dugmeta u istom redu, pa se nije vidjelo šta je odrađena
   * serija a šta ponuda — a dropset je ionako rijedak.
   *
   * Sada je put: dodir na seriju → red za izmjenu → strelica. Dropset je time
   * vezan baš za seriju na koju si pritisnuo, i ne zauzima mjesto dok ne treba.
   */
  startDropset(set: LoggedSet) {
    if (set.pending) return;   // još nije u bazi — nema na šta da se veže
    set.editing = false;
    set.addingDropset = true;
    set.dropsetWeightInput = null;
    set.dropsetRepsInput = null;
  }

  toggleDropsetForm(set: LoggedSet) {
    if (set.pending) return;
    set.addingDropset = !set.addingDropset;
    set.dropsetWeightInput = null;
    set.dropsetRepsInput = null;
  }

  async saveDropset(ex: TodayExercice, set: LoggedSet) {
    // Prazno polje kilaže znači tjelesnu težinu (0) — isti obrazac kao pri
    // upisu serije. Mjeri se i po samoj seriji: drop na seriji odrađenoj bez
    // tega ostaje BW i pošto se flag vježbe ugasi.
    const weight = set.dropsetWeightInput ?? (this.bwField(ex, set.weight) ? 0 : null);
    if (set.dropsetRepsInput == null || weight == null || set.savingDropset) return;
    if (weight < 0 || weight > 1000) return;

    set.savingDropset = true;
    const reps = set.dropsetRepsInput;

    try {
      const saved = await this.trainingService.logDropset({
        exerciceLogId: set.id,
        orderNum: set.dropsets.length + 1,
        reps,
        weight
      });

      set.dropsets.push({ ...saved, deleting: false });
      set.addingDropset = false;
      set.dropsetWeightInput = null;
      set.dropsetRepsInput = null;

      // Kod jednoručne vježbe dropset se preslika i na ISTU seriju druge ruke
      // — isti princip kao upis serije: jedan unos puni obje. Ako druga ruka
      // nije radila drop, njen se obriše jednim dodirom na X.
      const twin = ex.isUnilateral && set.side
        ? ex.loggedSets.find(s => s.side === (set.side === 'L' ? 'D' : 'L')
                               && s.setNumber === set.setNumber && !s.pending)
        : null;
      if (twin) {
        const mirrored = await this.trainingService.logDropset({
          exerciceLogId: twin.id,
          orderNum: twin.dropsets.length + 1,
          reps,
          weight
        });
        twin.dropsets.push({ ...mirrored, deleting: false });
      }
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom upisa dropseta.');

      // Serije nema u bazi, a ekran je i dalje pokazuje. Bez osvježavanja bi
      // ostala na spisku i svaki sljedeći pokušaj bi pao na isti način.
      if (/dropset_logs_exercice_log_id_fkey/i.test(String(err?.message ?? ''))) {
        set.addingDropset = false;
        void this.reloadAfterSync();
      }
    } finally {
      set.savingDropset = false;
    }
  }

  /**
   * Izmjena dropseta — isti tok kao izmjena serije: dodir na pilulu, polja,
   * sačuvaj/otkaži. Namjerno se NE preslikava na drugu ruku: preslikava se
   * samo nastanak (da se ne kuca dvaput), a izmjena postoji baš zato da se
   * jedna strana ispravi kad se razlikovala.
   */
  startEditDropset(ex: TodayExercice, dropset: DropsetEntry) {
    if (this.isFinished || dropset.deleting) return;
    dropset.editing = true;
    // Kao i kod serije: kilaža 0 je „bez tega", ne nula — i po flagu vježbe i
    // po samom redu, pa stari BW dropset ostaje takav i poslije gašenja flaga.
    dropset.editWeight = this.bwField(ex, dropset.weight) ? null : dropset.weight;
    dropset.editReps = dropset.reps;
  }

  cancelEditDropset(dropset: DropsetEntry) {
    dropset.editing = false;
  }

  async saveEditDropset(ex: TodayExercice, dropset: DropsetEntry) {
    const weight = dropset.editWeight ?? (this.bwField(ex, dropset.weight) ? 0 : null);
    if (dropset.editReps == null || weight == null || dropset.saving) return;
    if (weight < 0 || weight > 1000) return;

    dropset.saving = true;
    try {
      const updated = await this.trainingService.updateDropset(
        dropset.id, dropset.editReps, weight
      );
      dropset.reps = updated.reps;
      dropset.weight = updated.weight;
      dropset.editing = false;
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom izmjene dropseta.');
    } finally {
      dropset.saving = false;
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
    clearInterval(this.restTick);
    clearTimeout(this.tiClosingTimer);
    clearTimeout(this.tiFlashTimer);
    clearTimeout(this.bwFlipTimer);
    clearTimeout(this.layoutTimer);
    // Header je zajednički za sve rute — bez ovoga bi strelica "nazad" ostala
    // sakrivena i na drugim ekranima ako se stranica napusti (npr. preko
    // futera) dok je neki edit mod bio otvoren.
    this.navLock.unlock();
  }

  /** Paljenje/gašenje tajmera — gašenje nosi svoju animaciju skupljanja. */
  async toggleTimer() {
    if (this.restTimer.enabled) {
      this.tiClosing = true;
      clearTimeout(this.tiClosingTimer);
      this.tiClosingTimer = setTimeout(() => this.tiClosing = false, 480);
    }
    await this.restTimer.toggle();
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

  get isFinished(): boolean { return this.viewOnly || !!this.session?.finishedAt; }

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
    /** "42 min" / "1 h 15 min" — koliko je trening trajao, od početka do kraja. */
    elapsedLabel: string | null;
    line: string;
    /** `unit` je „kg", a kod čistih bodyweight vježbi „pon." — vidi `prMetric`. */
    records: { name: string; weight: number; previous: number | null; unit: string }[];
    rows: { name: string; outcome: 'up' | 'same' | 'down'; detail: string }[];
  } | null = null;

  showSummary = false;

  private buildSummary() {
    const records: { name: string; weight: number; previous: number | null; unit: string }[] = [];
    const rows: { name: string; outcome: 'up' | 'same' | 'down'; detail: string }[] = [];

    for (const ex of this.exercices) {
      if (ex.loggedSets.length === 0) continue;

      if (ex.isPr) {
        const m = this.prMetric(ex);
        records.push({ name: ex.name, weight: m.value, previous: m.previous, unit: m.unit });
        continue;   // rekord se prikazuje zasebno, ne i u spisku ishoda
      }

      // Ishod se broji po SERIJI, ne po redu u bazi — inače jednoručni dan
      // prijavi „6 serija bolje" tamo gdje ih je odrađeno tri.
      const perSet = this.setDeltas(ex);
      const up = perSet.filter(d => d === 'up').length;
      const down = perSet.filter(d => d === 'down').length;
      const compared = perSet.filter(d => d !== null).length;
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

    const elapsedLabel = (this.session?.startedAt && this.session?.finishedAt)
      ? this.formatElapsed(this.session.startedAt, this.session.finishedAt)
      : null;

    this.summary = { tone, headline, elapsedLabel, line, records, rows };
  }

  /**
   * Jedna ocjena po SERIJI (kod jednoručne vježbe po paru L+D).
   *
   * Par vrijedi onoliko koliko njegova SLABIJA strana: napredak je napredak tek
   * kad nijedna ruka nije nazadovala. Serija koja se nema s čim porediti daje
   * `null` i ne ulazi u sažetak.
   */
  private setDeltas(ex: TodayExercice): Delta[] {
    const rank: Record<string, number> = { down: 0, same: 1, up: 2 };

    return this.setNumbers(ex).map(n => {
      const rows = ex.loggedSets.filter(s => s.setNumber === n && s.delta !== null);
      if (rows.length === 0) return null;
      return rows.reduce((worst, s) => rank[s.delta!] < rank[worst.delta!] ? s : worst).delta;
    });
  }

  /** "42 min" / "1 h 15 min" — isti format kao "Trenira sada" na dashboardu. */
  private formatElapsed(startedAt: string, finishedAt: string): string {
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const minutes = Math.max(0, Math.round(ms / 60_000));

    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  closeSummary() { this.showSummary = false; }

  /**
   * Ukupno ODRAĐENIH serija danas — prikazuje se uz oznaku da je trening gotov.
   * Po istom pravilu kao `doneCount`: par L+D je jedna serija, ne dvije.
   */
  get totalSets(): number {
    return this.exercices.reduce((n, e) => n + this.doneCount(e), 0);
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

      // Ponovno otvaranje poslije isteka živog prozora: sat se vraća na sada,
      // inače bi „Trening u toku" i „Trenira sada" ostali mrtvi iako se
      // ponovo trenira (jutarnji trening + večernje otvaranje). Skorije
      // otvaranje ne dira sat — nastavlja od pravog početka, rezime istinit.
      const started = this.session.startedAt
        ? new Date(this.session.startedAt).getTime() : 0;
      if (Date.now() - started > LIVE_WINDOW_H * 3_600_000) {
        try {
          const now = new Date().toISOString();
          await this.trainingService.restartSessionClock(this.session.id);
          this.session.startedAt = now;
        } catch {
          // Sat je ukras — ne smije oboriti ponovno otvaranje.
        }
      }
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
    if (this.viewOnly) return;   // bilješka iz istorije se čita, ne mijenja
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
