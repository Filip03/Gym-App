import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router'

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit{

  fadeOut = false;

  constructor(private router: Router){}

  ngOnInit(){

    setTimeout(() => {
      this.fadeOut = true;
    }, 3000);

    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 4000)
  }
}
