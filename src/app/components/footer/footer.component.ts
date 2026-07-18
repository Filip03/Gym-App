import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service'
import { Router } from '@angular/router';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {

  constructor(private service: AuthService, private router: Router){}

  async signOut(){
    await this.service.signOut();
    this.router.navigate(['/login']);
  }

}
