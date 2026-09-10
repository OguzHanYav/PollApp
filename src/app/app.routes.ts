import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/poll-list/poll-list.component').then(
        (m) => m.PollListComponent
      ),
  },
  {
    path: 'poll/:id',
    loadComponent: () =>
      import('./features/poll-detail/poll-detail.component').then(
        (m) => m.PollDetailComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];