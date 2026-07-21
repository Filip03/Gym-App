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

const routes: Routes = [
  {path: "dashboard", component: DashboardComponent},
  {path: "training", component: TrainingComponent},
  {path: "exercices", component: ExercicesComponent},
  {path: "leaderboard", component: LeaderboardComponent},
  {path: "profiles", component: ProfileComponent},
  {path: "register", component: RegisterComponent},
  {path: "login", component: LoginComponent},
  {path: "", component: LandingComponent}

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
