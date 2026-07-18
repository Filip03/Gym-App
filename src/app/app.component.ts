import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router'
import { filter } from 'rxjs'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent{
  
 showLayout = true;
 showFooter = true;

  constructor(private router: Router) {
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

        this.showLayout = !hiddenRoutes.includes(this.router.url);
        this.showFooter = !hiddenRoutesFooter.includes(this.router.url);
      });
  }
}
