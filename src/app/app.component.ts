import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router'
import { filter } from 'rxjs'
import { ExerciceDetailService } from './components/shared/exercice-detail/exercice-detail.service';
import { ProfilePreviewService } from './shared/profile-preview.directive';
import { PushNotificationService } from './services/push-notification.service';
import { AuthService } from './services/auth.service';
import { LastRouteService } from './services/last-route.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent{

 showLayout = true;
 showFooter = true;

 // Ekrani sa mrežom (kartice jedna pored druge) traže više prostora na laptopu.
 // Ekrani sa listom se čitaju bolje u uskoj koloni — red od 1100px je predaleko
 // da oko prati od naziva vježbe do dugmeta.
 wide = false;

 private readonly wideRoutes = ['/dashboard', '/exercices', '/blog'];

  constructor(
    private router: Router,
    public preview: ProfilePreviewService,
    public exDetail: ExerciceDetailService,
    push: PushNotificationService,
    private auth: AuthService,
    private lastRoute: LastRouteService
  ) {
    // Tiha obnova push registracije pri svakom pokretanju — ako je dozvola već
    // data i prekidač uključen, ne radi ništa vidljivo (nema prompta).
    void push.ensureRegistered();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

        // Slojevi iz LJUSKE (pregled vježbe, pregled profila) žive iznad svih
        // ruta, pa ih promjena rute sama ne ruši — otkad je meni vidljiv (i
        // klikabilan) ispod plutajuće kartice, navigacija bi ih ostavila da
        // vise nad novim ekranom. Zatvaranje je idempotentno.
        this.exDetail.close();
        this.preview.close();

        // Osigurač: navigacija NIKAD ne smije zateći sakriven header/meni
        // (imerzivni pregled ih skloni; ma šta se desilo pregledu, rute ih
        // vraćaju).
        document.documentElement.classList.remove('immersive');

        const hiddenRoutes = [
          '/',
        ];

        const hiddenRoutesFooter = [
          '/',
          '/login',
          '/register'
        ]

        // Poredi se samo putanja, bez query parametara i fragmenta. Otkad guard
        // preusmjerava na "/login?redirect=...", puni router.url se više ne
        // poklapa sa "/login" i footer bi se pojavio na ekranu za prijavu.
        const path = this.router.url.split(/[?#]/)[0];

        this.showLayout = !hiddenRoutes.includes(path);
        this.showFooter = !hiddenRoutesFooter.includes(path);
        this.wide = this.wideRoutes.includes(path);

        // Pamti gdje je korisnik, sa query parametrima (?date= mora ostati) —
        // da ga PWA relaunch sa splasha vrati na isto mjesto, ne na dashboard.
        // Servis sam odbija rute van bijele liste (/, /login, /register...).
        const user = this.auth.getCurrentUser();
        if (user) this.lastRoute.remember(this.router.url, user.id);
      });
  }
}
