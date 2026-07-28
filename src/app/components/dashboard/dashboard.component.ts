import { Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { LeaderboardService, LiveSession } from '../../services/leaderboard.service';
import { WorkoutPlan, PlanType, DayType, Exercice } from '../../models/models';
import { DAY_NAMES } from '../../shared/day-names';
import { ExerciceService } from '../../services/exercice.service';
import { TrainingService } from '../../services/training.service';
import { DAY_NAMES as DAYS } from '../../shared/day-names';

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
export class DashboardComponent implements OnInit, OnDestroy {
  myPlans: any[] = [];
  otherPlans: any[] = [];
  planTypes: PlanType[] = [];
  dayTypes: DayType[] = [];

  loading = true;
  errorMessage = '';

  showCreateModal = false;
  creating = false;
  createError = '';
  editingPlanId: string | null = null;

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

  /**
   * Visina okvira karusela prati AKTIVNI dan.
   *
   * Sve stranice stoje jedna pored druge u traci, pa bi bez ovoga okvir bio
   * visok koliko najduži dan i ispod kratkih dana bi zjapila praznina.
   */
  viewportHeight = 0;

  @ViewChildren('daySlide') daySlides!: QueryList<ElementRef<HTMLElement>>;

  showExercicePicker = false;
  pickerDay: DayEntry | null = null;

  private dayNames = DAY_NAMES;

  // Šta je danas na redu — prikazuje se na traci iznad planova.
  todayName = '';
  todayType: string | null = null;
  todayCount = 0;
  todayFinished = false;
  todayStartedAt: string | null = null;
  /** „12:34" ili „1:02:34" — koliko traje današnji trening. Kuca svake sekunde. */
  elapsedLabel = '';
  private elapsedTimer: any = null;

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
    private trainingService: TrainingService,
    private leaderboardService: LeaderboardService,
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
    this.currentUserId = user.id;

    void this.loadLive();
    // Trening traje, pa broj minuta mora da raste sam. Interval se čisti u
    // `ngOnDestroy` — bez toga bi kucao i poslije napuštanja ekrana.
    this.liveTimer = setInterval(() => void this.loadLive(), 60_000);

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

    await this.loadToday(user.id);
  }

  /** Dan i tip treninga za danas, po planu koji korisnik prati ili ima aktivan. */
  private async loadToday(userId: string) {
    const jsDay = new Date().getDay();
    this.todayName = DAYS[jsDay === 0 ? 6 : jsDay - 1];

    try {
      const plan = await this.trainingService.getPlanForUser(userId);
      const day = (plan?.workout_days ?? []).find((d: any) => d.name === this.todayName);
      this.todayType = day?.day_type?.name ?? null;
      this.todayCount = (day?.day_exercice ?? []).length;

      const times = await this.trainingService.getSessionTimes(userId, this.todayDateString());
      this.todayFinished = !!times.finishedAt;
      this.todayStartedAt = times.startedAt;

      // Tajmer kuca svake sekunde, ali samo dok je trening u toku — `tick`
      // sam isprazni natpis čim trening prestane da se vodi kao aktivan.
      this.tickElapsed();
      this.elapsedTimer = setInterval(() => this.tickElapsed(), 1000);
    } catch {
      // Traka je informativna — ako plan ne može da se učita, ostaje samo dan.
    }
  }

  /**
   * Kašnjenje ulazne animacije kartice plana, u milisekundama.
   *
   * `section` je 0 za „Moji planovi", 1 za „Planovi ostalih" — druga kolona
   * kreće nešto kasnije, pa se vidi da su to dvije grupe a ne jedna. Kašnjenje
   * unutar grupe je ograničeno, da posljednja kartica ne čeka predugo kad neko
   * ima desetak planova.
   */
  cardDelay(section: number, index: number): number {
    return 260 + section * 90 + Math.min(index * 55, 330);
  }

  // --- Ko trenira sada --------------------------------------------------------
  //
  // Stoji na dashboardu, odmah uz dugme „Započni trening" — tu se i staje kad
  // se aplikacija otvori, pa je to jedino mjesto gdje podatak nešto mijenja:
  // ako neko već trenira, veća je šansa da i ti kreneš.
  live: LiveSession[] = [];
  currentUserId = '';
  private liveTimer: any = null;

  ngOnDestroy() {
    if (this.liveTimer) clearInterval(this.liveTimer);
    if (this.elapsedTimer) clearInterval(this.elapsedTimer);
  }

  /**
   * Da li se današnji trening upravo dešava.
   *
   * Isto pravilo kao „ko trenira sada": sesija postoji (ekran treninga je
   * otvaran), nije završena, i nije starija od 4 sata — poslije toga je
   * vjerovatnije da je čovjek zaboravio da pritisne kraj nego da još trenira.
   */
  get todayInProgress(): boolean {
    if (this.todayFinished || !this.todayStartedAt) return false;
    return Date.now() - new Date(this.todayStartedAt).getTime() < 4 * 3_600_000;
  }

  private tickElapsed() {
    if (!this.todayInProgress) { this.elapsedLabel = ''; return; }
    const total = Math.floor((Date.now() - new Date(this.todayStartedAt!).getTime()) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const mm = `${m}`.padStart(2, '0');
    const ss = `${sec}`.padStart(2, '0');
    this.elapsedLabel = h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }

  private async loadLive() {
    try {
      this.live = await this.leaderboardService.getLiveSessions();
    } catch {
      this.live = [];   // dodatak, ne smije oboriti ekran
    }
  }

  /** „42 min" / „1 h 12 min" — sati tek kad ih ima. */
  liveTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  trackLive = (_: number, l: LiveSession) => l.userId;

  goToTraining() {
    this.router.navigate(['/training']);
  }

  private todayDateString(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  /**
   * Promjena redoslijeda vježbi u danu plana.
   *
   * Redoslijed se pri snimanju izvodi iz položaja u nizu (orderNum: index + 1),
   * pa je dovoljno zamijeniti mjesta. Ovo je JEDINO mjesto gdje se redoslijed
   * mijenja trajno — preređivanje u toku treninga vrijedi samo za taj dan.
   */
  moveInDay(day: DayEntry, index: number, direction: -1 | 1) {
    const to = index + direction;
    if (to < 0 || to >= day.selectedExercices.length) return;

    const list = day.selectedExercices;
    [list[index], list[to]] = [list[to], list[index]];
  }

  openCreateModal() {
    this.showCreateModal = true;
    this.initWeekDays();
    this.filteredDayTypes = [];
    this.currentDayIndex = 0;
    this.closeExercicePicker();
  }

  // --- Prevlačenje prstom ----------------------------------------------------
  //
  // Na telefonu su strelice ispod špila jedini način da se promijeni dan, a
  // prirodan pokret je prevlačenje po samim kartama. Namjerno se NE koristi
  // `touchmove` sa praćenjem prsta: karte bi tada morale da prate pomjeraj, a
  // to se tuče sa 3D transformacijama špila. Ovdje se samo mjeri odakle dokle
  // je prst otišao.

  private touchX = 0;
  private touchY = 0;
  private touchTracking = false;

  onDeckTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) return;   // štipanje za uvećanje nije prevlačenje
    this.touchX = event.touches[0].clientX;
    this.touchY = event.touches[0].clientY;
    this.touchTracking = true;
  }

  onDeckTouchEnd(event: TouchEvent, totalDays: number) {
    if (!this.touchTracking) return;
    this.touchTracking = false;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this.touchX;
    const dy = touch.clientY - this.touchY;

    // Prag od 50px da slučajan dodir ne preskoči dan, i uslov da je pokret
    // pretežno vodoravan — inače bi svako skrolovanje kroz duži dan mijenjalo
    // stranicu.
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    if (dx < 0) this.nextDay(totalDays);
    else this.prevDay();
  }

  nextDay(totalDays: number) {
    if (this.currentDayIndex < totalDays - 1) { this.currentDayIndex++; this.syncHeight(); }
  }

  prevDay() {
    if (this.currentDayIndex > 0) { this.currentDayIndex--; this.syncHeight(); }
  }

  goToDay(index: number) {
    this.currentDayIndex = index;
    this.syncHeight();
  }

  /**
   * Položaj jedne stranice u špilu.
   *
   * Dani stoje jedan iza drugog kao karte: aktivni je sprijeda, naredna dva
   * proviruju ispod njega sve manja i bljeđa, prethodni su odletjeli ulijevo.
   * Time se vidi da lista ima nastavak, umjesto ranijeg ukrasa od dvije lažne
   * "stranice" koje se nikad nisu mijenjale.
   */
  slideStyle(index: number): Record<string, string> {
    const offset = index - this.currentDayIndex;

    // Odigrana karta odlijeće ulijevo uz zaokret — kao kad se karta baci sa
    // vrha špila, a ne kao da je neko povukao klizač.
    if (offset < 0) {
      return {
        transform: 'translateX(-128%) translateZ(60px) rotate(-9deg) rotateY(22deg)',
        opacity: '0',
        zIndex: '0',
        pointerEvents: 'none'
      };
    }

    const depth = Math.min(offset, 3);

    // Blagi nagib koji se smjenjuje po dubini — špil složen rukom, ne mašinom.
    const tilt = depth === 0 ? 0 : (depth % 2 === 1 ? 0.7 : -0.55) * depth;

    const shrink = 1 - depth * 0.045;
    const push = depth * 46;          // udaljenost u dubinu

    // Pomak nadolje mora NADOKNADITI sve što kartu skuplja, inače joj donja
    // ivica završi IZNAD prednje i špil se uopšte ne vidi. Skupljaju je dvije
    // stvari: samo smanjenje (transform-origin je gornja ivica) i perspektiva,
    // koja udaljeni objekat prikazuje manjim za p / (p + z).
    const PERSPECTIVE = 1500;
    const H = this.viewportHeight || 0;

    const scaleLoss = H * (1 - shrink);
    const depthLoss = H * (push / (PERSPECTIVE + push));
    const lift = scaleLoss + depthLoss + depth * 15;   // 15px stvarnog provirivanja

    return {
      // SVE karte imaju visinu prednje. Bez toga kraći dan potpuno nestane iza
      // dužeg i špil se ne vidi — a koji je dan kraći zavisi od plana.
      height: this.viewportHeight ? this.viewportHeight + 'px' : 'auto',
      transform:
        `translateY(${lift}px) translateZ(${-push}px) rotateX(${depth * 1.6}deg) rotate(${tilt}deg) scale(${shrink})`,
      opacity: offset === 0 ? '1' : offset === 1 ? '.7' : offset === 2 ? '.4' : '0',
      filter: offset === 0 ? 'none' : `brightness(${1 - depth * 0.14}) blur(${depth * 0.4}px)`,
      zIndex: String(20 - depth),
      pointerEvents: offset === 0 ? 'auto' : 'none'
    };
  }

  /** "Ponedeljak" -> "PON". Kartice dana moraju stati u jedan red na telefonu. */
  shortDay(name: string | null): string {
    return (name ?? '').slice(0, 3).toUpperCase();
  }

  /**
   * Uskladi visinu okvira sa aktivnim danom.
   *
   * Mjeri se izvan ciklusa provjere (setTimeout), jer postavljanje vrijednosti
   * unutar ngAfterViewChecked ne pokreće novo iscrtavanje — okvir je zbog toga
   * ostajao na nuli i sadržaj se uopšte nije vidio.
   */
  /**
   * Visina okvira dana prije prvog mjerenja, u pikselima.
   *
   * MORA biti broj, ne `auto`. Ranije je stajalo `height: auto` dok podaci ne
   * stignu, a `auto → 610px` se u CSS-u **ne interpolira** — visina je zato
   * skakala u jednom kadru, bez obzira što `transition: height` postoji. To je
   * bio onaj trzaj pri otvaranju plana.
   */
  readonly deckStartHeight = 320;

  /** Da li je prva izmjerena visina već primijenjena. */
  deckReady = false;

  private syncHeight(attempt = 0) {
    setTimeout(() => {
      const slide = this.daySlides?.get(this.currentDayIndex)?.nativeElement;
      const h = slide?.offsetHeight ?? 0;

      if (h) {
        // Prvi put: početna visina mora biti ISCRTANA prije nego što se pređe na
        // izmjerenu, inače pregledač spoji obje promjene u jedan kadar i nema
        // šta da se animira. Dva `requestAnimationFrame`-a to garantuju.
        if (!this.deckReady) {
          this.deckReady = true;
          requestAnimationFrame(() =>
            requestAnimationFrame(() => { this.viewportHeight = h; })
          );
        } else {
          this.viewportHeight = h;
        }
        return;
      }

      // Slike vježbi i fontovi mogu stići poslije; par pokušaja je dovoljno.
      if (attempt < 5) this.syncHeight(attempt + 1);
    }, attempt === 0 ? 0 : 120);
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.newPlanName = '';
    this.newPlanDescription = '';
    this.newPlanTypeId = '';
    this.createError = '';
    this.weekDays = [];
    this.filteredDayTypes = [];
    this.editingPlanId = null;
    this.closeExercicePicker();
  }

  // Otvara isti modal kao za kreiranje plana, samo popunjen postojećim podacima
  async openEditModal() {
    if (!this.viewedPlan) return;

    this.editingPlanId = this.viewedPlan.id;
    this.newPlanName = this.viewedPlan.name ?? '';
    this.newPlanDescription = this.viewedPlan.description ?? '';
    this.newPlanTypeId = this.viewedPlan.plan_type_id ?? '';
    this.createError = '';

    this.onPlanTypeChange();

    const workoutDaysByName = new Map<string, any>(
      (this.viewedPlan.workout_days ?? []).map((d: any) => [d.name, d])
    );

    this.weekDays = this.dayNames.map((name, index) => {
      const existing = workoutDaysByName.get(name);
      const dayTypeName = existing?.day_type?.name ?? null;
      const dayTypeId = dayTypeName
        ? this.dayTypes.find(dt => dt.name === dayTypeName)?.id ?? null
        : null;

      const selectedExercices: SelectedExercice[] = ((existing?.day_exercice ?? []) as any[])
        .slice()
        .sort((a, b) => a.order_num - b.order_num)
        .map(dayEx => ({
          exerciceId: dayEx.exercice_id,
          name: dayEx.exercices?.name ?? '',
          targetSets: dayEx.target_sets,
          targetReps: dayEx.target_reps
        }));

      return {
        dayNumber: index + 1,
        dayName: name,
        dayTypeId,
        availableExercices: [],
        selectedExercices
      };
    });

    // Učitaj dostupne vježbe za svaki dan koji već ima izabran tip,
    // da bi picker modal mogao da ih ponudi za izmenu
    for (const day of this.weekDays) {
      if (day.dayTypeId) {
        try {
          day.availableExercices = await this.dashboardService.getExercicesForDayType(day.dayTypeId);
        } catch {
          // vežbe za taj dan jednostavno neće biti ponuđene za izmenu
        }
      }
    }

    this.closeViewModal();
    this.showCreateModal = true;
    this.currentDayIndex = 0;
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

      if (this.editingPlanId) {
        await this.dashboardService.updateFullPlan(
          this.editingPlanId,
          {
            name: this.newPlanName,
            description: this.newPlanDescription,
            plan_type_id: this.newPlanTypeId
          },
          daysPayload
        );
      } else {
        await this.dashboardService.createFullPlan(
          {
            name: this.newPlanName,
            description: this.newPlanDescription,
            plan_type_id: this.newPlanTypeId,
            created_by: user.id
          },
          daysPayload
        );
      }

      this.myPlans = await this.dashboardService.getMyPlans(user.id);
      this.closeCreateModal();
    } catch (err: any) {
      this.createError = err.message ?? (this.editingPlanId ? 'Greška prilikom izmene plana.' : 'Greška prilikom kreiranja plana.');
    } finally {
      this.creating = false;
    }
  }

  async openViewModal(planId: string) {
    this.showViewModal = true;
    this.deckReady = false;
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

      this.syncHeight();

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
    this.viewportHeight = 0;
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