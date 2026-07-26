import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { AudioService } from '../../services/audio.service';
import { humanError } from '../../shared/errors';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent{
  email = '';
  password = '';
  username = '';
  weight = 0.0;
  height = 0;
  errorMessage = '';
  successMessage = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private audio: AudioService
  ) {}

  async onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    try {
      await this.authService.signUp(this.email, this.password, this.username, this.weight, this.height);

      // Zvuk se pušta, ali se NE čeka. Ranije je ovdje stajalo `await` na
      // obećanje koje se ispuni tek na `onended` — pa je blokiran autoplay
      // značio da se obećanje nikad ne ispuni i da korisnik nakon uspješne
      // registracije zauvijek ostane na ovom ekranu. A i kad je prolazilo,
      // čekalo se punih 13 sekundi.
      this.audio.play('register');
      this.router.navigate(['/login']);
    } catch (err: any) {
      this.errorMessage = humanError(err, 'Greška prilikom registracije.');
    } finally {
      this.loading = false;
    }
  }
}