import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  email = '';
  password = '';
  username = '';
  weight = 0.0;
  height = 0;
  errorMessage = '';
  successMessage = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  playAudio():Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio('assets/prskulja.m4a');

      audio.volume = 0.5;

      audio.onended = () => {
        resolve();
      };

      audio.play();
    });
}

  async onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    try {
      await this.authService.signUp(this.email, this.password, this.username, this.weight, this.height);
      await this.playAudio();
      this.router.navigate(['/login'])
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom registracije.';
    } finally {
      this.loading = false;
    }
  }
}