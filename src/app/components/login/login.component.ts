import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';

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

  // Kad te guard preusmjeri sa zaštićene rute, upamti gdje si htio da ideš.
  private redirectTo = '/dashboard';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(){
    this.redirectTo = this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';
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
      this.router.navigateByUrl(this.redirectTo);
    } catch (err: any) {
      this.errorMessage = err.message ?? 'Greška prilikom logovanja.';
    } finally {
      this.loading = false;
    }
  }
}