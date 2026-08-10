import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
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
 */

const T_EXIT = 2600;    // gašenje počinje (mora pratiti `.leaving` u SCSS)
const T_LEAVE = 3100;   // preusmjerenje

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  fadeOut = false;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private leaving = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    public theme: ThemeService
  ) {}

  ngOnInit() {
    this.timers.push(setTimeout(() => { this.fadeOut = true; }, T_EXIT));
    this.timers.push(setTimeout(() => this.leave(), T_LEAVE));
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
      this.router.navigate([user ? '/dashboard' : '/login']);
    })();
  }

  private stop() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  ngOnDestroy() {
    // Bez ovoga tajmer nastavi da radi i nakon što korisnik ode sa landinga,
    // pa ga sekundu kasnije izbaci nazad usred nečega drugog.
    this.stop();
  }
}
