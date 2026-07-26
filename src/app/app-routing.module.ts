import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegisterComponent } from './components/register/register.component'
import { LoginComponent } from './components/login/login.component'
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LandingComponent } from './components/landing/landing.component';
import { TrainingComponent } from './components/training/training.component';
import { ExercicesComponent } from './components/exercices/exercices.component';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { ProfileComponent } from './components/profile/profile.component';
import { BlogComponent } from './components/blog/blog.component'
import { authGuard, guestGuard } from './guards/auth.guard';

const routes: Routes = [
  {path: "dashboard", component: DashboardComponent, canActivate: [authGuard]},
  {path: "training", component: TrainingComponent, canActivate: [authGuard]},
  {path: "exercices", component: ExercicesComponent, canActivate: [authGuard]},
  {path: "leaderboard", component: LeaderboardComponent, canActivate: [authGuard]},
  {path: "profiles", component: ProfileComponent, canActivate: [authGuard]},
  {path: "blog", component: BlogComponent, canActivate: [authGuard]},

  {path: "register", component: RegisterComponent, canActivate: [guestGuard]},
  {path: "login", component: LoginComponent, canActivate: [guestGuard]},

  {path: "", component: LandingComponent},

  // Nepostojeća putanja je do sada davala prazan ekran bez ijedne poruke.
  {path: "**", redirectTo: ""}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
