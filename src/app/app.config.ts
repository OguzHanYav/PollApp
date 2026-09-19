import { ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Hash-Routing (/#/poll/56 statt /poll/56): Deep-Links/Reload
    // funktionieren dadurch auch ohne .htaccess-Rewrite auf dem Server,
    // weil der Browser bei jedem Request immer nur den Basis-Pfad
    // (index.html) anfragt und alles nach dem "#" rein clientseitig ist.
    provideRouter(routes, withHashLocation())
    // ggf. weitere bestehende Provider hier ergänzen
  ]
};
