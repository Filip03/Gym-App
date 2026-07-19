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


  email = '';
  password = '';
  errorMessage = '';
  loading = false;
  audioOver = false;

  private audioPromise!: Promise<void>;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(){
    this.audioPromise = this.playAudio();
  }

   playAudio():Promise<void> {
    return new Promise((resolve) => {
      const audio = new Audio('assets/ko je.m4a');

      audio.volume = 0.5;

      audio.onended = () => {
        resolve();
      };

      audio.play();
    });
  }

  async onSubmit() {
    this.errorMessage = '';
    this.loading = true;

    try {
      await this.audioPromise
      await this.authService.signIn(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom logovanja.';
    } finally {
      this.loading = false;
    }
  }
}