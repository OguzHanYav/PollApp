# Poll App

Eine Angular-Anwendung zum Erstellen, Teilen und live Auswerten von Umfragen. Nutzer:innen legen Umfragen mit mehreren Fragen und Antwortoptionen an, stimmen ab und sehen die Ergebnisse in Echtzeit.

## Tech Stack

- [Angular](https://angular.dev/) 21 (Standalone Components, Signals)
- TypeScript
- SCSS
- [Supabase](https://supabase.com/) (Datenbank, Realtime)

## Features

- **Bald endende Umfragen** – aktive Umfragen mit nahendem Enddatum werden oberhalb der allgemeinen Liste hervorgehoben, sortiert nach frühestem Enddatum.
- **Übersichtsliste mit Filter** – Umfragen lassen sich per Reiter zwischen *Active* und *Past* wechseln.
- **Kategorien-Filter** – Umfragen können nach Kategorie gefiltert werden (inkl. Zurücksetzen auf "Alle").
- **Umfragen erstellen** – Formular als Overlay mit klar getrennten Pflicht- und optionalen Angaben inkl. Validierung.
- **Detailansicht mit Live-Auswertung** – Fragestellung, Antwortoptionen und aktueller Auswertungsstand einer Umfrage.
- **Abstimmen mit Live-Update** – abgegebene Stimmen aktualisieren die Auswertung in Echtzeit, auch in anderen geöffneten Tabs.

## Installation / Setup

```bash
npm install
ng serve
```

Die Anwendung ist anschließend unter `http://localhost:4200/` erreichbar.

### Supabase-Konfiguration

Die Verbindungsdaten liegen in `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  supabaseUrl: '...',
  supabaseKey: '...' // Anon-Key
};
```

Für ein eigenes Supabase-Projekt werden die Tabellen `polls`, `questions` und `answers` sowie (optional) die Postgres-Funktion `increment_vote` für atomares Stimmen-Zählen benötigt.

## Projektstruktur

```
src/app/
├── features/
│   ├── poll-list/      # Homescreen: Übersicht, Filter, "New Survey"
│   ├── poll-create/     # Formular zum Anlegen einer Umfrage (Overlay)
│   └── poll-detail/     # Detailansicht: Abstimmen + Live-Auswertung
└── shared/
    ├── models/          # Poll-, Question-, Answer-Interfaces
    └── services/        # PollService (Supabase-Zugriff, Realtime)
```

## Code Conventions

Das Projekt folgt den bereitgestellten Coding-Konventionen für TypeScript und HTML (u. a. kebab-case Dateinamen, camelCase Funktionen, keine `any`-Typen, semantisches HTML, Barrierefreiheit).
