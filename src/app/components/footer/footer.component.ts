import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service'
import { PushNotificationService } from '../../services/push-notification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {

  constructor(
    private service: AuthService,
    private router: Router,
    private pushNotifications: PushNotificationService
  ){}

  async signOut(){
    // Prije signOut-a — dok Supabase sesija još važi za Authorization header.
    await this.pushNotifications.unregisterFromPush();
    await this.service.signOut();
    this.router.navigate(['/login']);
  }

}
