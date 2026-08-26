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
    path: 'create',
    loadComponent: () =>
      import('./features/poll-create/poll-create.component').then(
        (m) => m.PollCreateComponent
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