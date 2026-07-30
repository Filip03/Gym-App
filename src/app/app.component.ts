import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router'
import { filter } from 'rxjs'
import { ProfilePreviewService } from './shared/profile-preview.directive';
import { PushNotificationService } from './services/push-notification.service';

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
    push: PushNotificationService
  ) {
    // Tiha obnova push registracije pri svakom pokretanju — ako je dozvola već
    // data i prekidač uključen, ne radi ništa vidljivo (nema prompta).
    void push.ensureRegistered();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

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
      });
  }
}
