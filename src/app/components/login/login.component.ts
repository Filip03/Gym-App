import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  async onSubmit() {
    this.errorMessage = '';
    this.loading = true;

    try {
      await this.authService.signIn(this.email, this.password);
      this.router.navigate(['/dashboard']); // promeni na tvoju glavnu rutu
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom logovanja.';
    } finally {
      this.loading = false;
    }
  }
}