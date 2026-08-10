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
import { NumFieldDirective } from './shared/num-field.directive';
import { ProfilePreviewDirective } from './shared/profile-preview.directive';
import { BubblePhysicsDirective } from './shared/bubble-physics.directive';
import { PortalDirective } from './shared/portal.directive';
import { BlogComponent } from './components/blog/blog.component';
import { HeaderComponent } from './components/header/header.component';
import { ExercicePickerComponent } from './components/shared/exercice-picker/exercice-picker.component';
import { ExerciceDetailComponent } from './components/shared/exercice-detail/exercice-detail.component';
import { DropdownComponent } from './components/shared/dropdown/dropdown.component';
import { DatePickerComponent } from './components/shared/date-picker/date-picker.component';
import { ProfilePreviewComponent } from './components/profile-preview/profile-preview.component';
import { NewsComponent } from './components/news/news.component';
import { GlitchOverlayComponent } from './components/glitch-overlay/glitch-overlay.component';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    LandingComponent,
    FooterComponent,
    HeaderComponent,
    TrainingComponent,
    ExercicesComponent,
    LeaderboardComponent,
    ProfileComponent,
    BlogComponent,
    ExercicePickerComponent,
    ExerciceDetailComponent,
    DropdownComponent,
    DatePickerComponent,
    ProfilePreviewComponent,
    NewsComponent,
    GlitchOverlayComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    RouterModule,
    RegisterComponent,
    LoginComponent,
    FormsModule,
    NumFieldDirective,
    ProfilePreviewDirective,
    BubblePhysicsDirective,
    PortalDirective,
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
