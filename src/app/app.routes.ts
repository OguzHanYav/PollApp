import { Routes } from '@angular/router';

// Hinweis: "New Survey" ist laut Vorgabe ein Dialog/Modal/Overlay und KEINE
// eigene Route mehr. Die vorherige Route 'create' -> PollCreateComponent
// wurde deshalb entfernt. PollCreateComponent wird jetzt direkt aus
// PollListComponent heraus als Overlay eingebunden.
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
