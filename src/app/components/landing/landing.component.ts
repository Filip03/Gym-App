import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router'
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {

  fadeOut = false;

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private router: Router, private authService: AuthService){}

  ngOnInit(){

    this.timers.push(setTimeout(() => {
      this.fadeOut = true;
    }, 3000));

    this.timers.push(setTimeout(async () => {
      // Prijavljen korisnik ide pravo na dashboard. Ranije je uvijek išao na
      // /login, pa ga je guard odatle vraćao — dva preusmjeravanja umjesto jednog.
      const user = await this.authService.waitForSession();
      this.router.navigate([user ? '/dashboard' : '/login']);
    }, 4000));
  }

  ngOnDestroy(){
    // Bez ovoga tajmer nastavi da radi i nakon što korisnik ode sa landinga,
    // pa ga 4 sekunde kasnije izbaci nazad usred nečega drugog.
    this.timers.forEach(clearTimeout);
  }
}
