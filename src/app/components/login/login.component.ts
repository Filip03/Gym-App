import { Component, OnInit } from '@angular/core';
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
export class LoginComponent implements OnInit{


  username = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(){
    this.playAudio();
  }

  playAudio(): void {
    const audio = new Audio('assets/ko je.m4a');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // autoplay može biti blokiran dok korisnik ne klikne na stranicu - nije bitno za login
    });
  }

  async onSubmit() {
    this.errorMessage = '';
    this.loading = true;

    try {
      await this.authService.signInWithUsername(this.username, this.password);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom logovanja.';
    } finally {
      this.loading = false;
    }
  }
}