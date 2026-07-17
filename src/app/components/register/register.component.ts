import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  email = '';
  password = '';
  username = '';
  errorMessage = '';
  successMessage = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  async onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;

    try {
      await this.authService.signUp(this.email, this.password, this.username);
      this.successMessage = 'Registracija uspešna! Proveri email za potvrdu (ako je uključena), zatim se uloguj.';
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom registracije.';
    } finally {
      this.loading = false;
    }
  }
}