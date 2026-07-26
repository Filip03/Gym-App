import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {


  username = '';
  password = '';
  errorMessage = '';
  loading = false;

  // Kad te guard preusmjeri sa zaštićene rute, upamti gdje si htio da ideš.
  private redirectTo = '/dashboard';
  private cancelSound: () => void = () => {};

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private audio: AudioService
  ) {}

  ngOnInit(){
    this.redirectTo = this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';

    // Klip je poruka "moraš se predstaviti" — pripada dolasku na ovaj ekran.
    // Pri prvom otvaranju stranice pregledač zabranjuje zvuk dok korisnik ništa
    // nije dodirnuo, pa playOrArm čeka prvi dodir (u praksi: klik na polje).
    this.cancelSound = this.audio.playOrArm('login');
  }

  ngOnDestroy() {
    // Zvuk pripada isključivo ovom ekranu — ne smije se preliti na dashboard.
    this.cancelSound();
    this.audio.stop();
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