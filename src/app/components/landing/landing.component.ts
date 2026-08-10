import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LastRouteService } from '../../services/last-route.service';
import { ThemeService } from '../../services/theme.service';

/**
 * SPLASH — „PLJESAK KREDE"
 *
 * Kratak udarac, kao pljesak dlanova prije teškog seta: oblak krede se
 * razleti iz centra, logo izroni tečnim jezikom (squash & stretch, vidi
 * `mark-surface` u SCSS-u), natpis se digne talasom, traka se puni do
 * preusmjerenja.
 *
 * Cijeli pokret je CSS (keyframe animacije tempirane `animation-delay`-om) —
 * ovdje ostaju samo tajmeri za gašenje i preusmjerenje. Prethodna verzija je
 * cijeli kadar crtala u JS-u (ASCII talas-polje, ~400 linija) — djelovalo je
 * kompjutorski/tehnički, ne kao teretana, pa je zamijenjeno ovim.
 *
 * `prefers-reduced-motion` se gasi isključivo u SCSS-u (sve animacije na
 * `none`, elementi ostaju u krajnjem stanju) — nema JS grane za to.
 *
 * PUNA vs KRATKA verzija: iOS pri svakom relaunch-u PWA kreće od start_url
 * "/", pa bi Marko puni splash od 3,1s gledao i kad samo zaključa ekran usred
 * treninga. Zato pun „pljesak" svira samo pri „hladnom" ulasku — kad zapisa
 * `gymapp.splashSeen` nema ili je stariji od SPLASH_FRESH_MS. Inače ide
 * KRATKI splash (~600ms): logo izroni i odmah krene postojeće pretapanje
 * (`fadeOut` → `.leaving`), pa `leave()`. Marker je u localStorage-u sa
 * vremenskim pragom, NE u sessionStorage-u: kad iOS ubije proces PWA,
 * sessionStorage se briše, pa bi svaki povratak opet imao pun splash.
 */

const T_EXIT = 2600;    // gašenje počinje (mora pratiti `.leaving` u SCSS)
const T_LEAVE = 3100;   // preusmjerenje

const T_EXIT_SHORT = 240;   // kratki splash: logo se tek pojavi pa pretopi
const T_LEAVE_SHORT = 620;  // preusmjerenje kratkog splasha (~600ms ukupno)

const SPLASH_SEEN_KEY = 'gymapp.splashSeen';
const SPLASH_FRESH_MS = 6 * 3_600_000;   // pun splash tek poslije 6h pauze

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  fadeOut = false;

  /** Kratka verzija splasha — vidi zaglavlje datoteke. Stil nosi `.quick`. */
  quick = false;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private leaving = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private lastRoute: LastRouteService,
    public theme: ThemeService
  ) {}

  ngOnInit() {
    this.quick = this.seenRecently();
    this.markSeen();

    this.timers.push(setTimeout(() => { this.fadeOut = true; },
                                this.quick ? T_EXIT_SHORT : T_EXIT));
    this.timers.push(setTimeout(() => this.leave(),
                                this.quick ? T_LEAVE_SHORT : T_LEAVE));
  }

  /** Dodir ili tipka bilo gdje preskače splash. Pretapanje krene odmah kao potvrda. */
  skip() {
    if (this.leaving) return;
    this.fadeOut = true;
    this.leave();
  }

  @HostListener('document:keydown')
  onKey() { this.skip(); }

  private leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.stop();

    void (async () => {
      // Prijavljen korisnik ide pravo na dashboard — ranije je uvijek išao na
      // /login, pa ga je guard odatle vraćao (dva preusmjeravanja umjesto jednog).
      const user = await this.authService.waitForSession();
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      // Svježa zapamćena ruta ima prednost nad dashboardom: iOS relaunch PWA
      // usred treninga mora da vrati na /training (sa ?date= ako ga je bilo),
      // ne na početni ekran. Pravila svježine: LastRouteService.consume().
      const last = this.lastRoute.consume(user.id);
      this.router.navigateByUrl(last ?? '/dashboard');
    })();
  }

  private stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  /** Da li je splash već odsviran u posljednjih SPLASH_FRESH_MS. */
  private seenRecently(): boolean {
    try {
      const ts = Number(localStorage.getItem(SPLASH_SEEN_KEY));
      return ts > 0 && Date.now() - ts < SPLASH_FRESH_MS;
    } catch {
      return false;
    }
  }

  private markSeen(): void {
    try {
      localStorage.setItem(SPLASH_SEEN_KEY, String(Date.now()));
    } catch {
      // localStorage nedostupan — u najgorem slučaju opet svira pun splash
    }
  }

  ngOnDestroy() {
    // Bez ovoga tajmer nastavi da radi i nakon što korisnik ode sa landinga,
    // pa ga sekundu kasnije izbaci nazad usred nečega drugog.
    this.stop();
  }
}
