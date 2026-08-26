import { Routes } from '@angular/router';
import { PollListComponent } from './features/poll-list/poll-list.component';
import { PollCreateComponent } from './features/poll-create/poll-create.component';
import { PollDetailComponent } from './features/poll-detail/poll-detail.component';

export const routes: Routes = [
  { path: '', component: PollListComponent },
  { path: 'create', component: PollCreateComponent },
  { path: 'poll/:id', component: PollDetailComponent },
  { path: '**', redirectTo: '' }
];

// In poll-list.component.html: Button "New survey" jetzt mit
// routerLink="/create" statt (click)="openCreateOverlay()" verlinken.
