import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms'

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { RegisterComponent } from './components/register/register.component';
import { LoginComponent } from './components/login/login.component';
import { RouterModule } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LandingComponent } from './components/landing/landing.component';
import { FooterComponent } from './components/footer/footer.component';
import { TrainingComponent } from './components/training/training.component';
import { ExercicesComponent } from './components/exercices/exercices.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { ProfileComponent } from './components/profile/profile.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { BlogComponent } from './components/blog/blog.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    LandingComponent,
    FooterComponent,
    TrainingComponent,
    ExercicesComponent,
    LeaderboardComponent,
    ProfileComponent,
    BlogComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterModule,
    RegisterComponent,
    LoginComponent,
    FormsModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
