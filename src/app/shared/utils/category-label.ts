// Zeigt Kategorien einheitlich auf Englisch an, unabhängig davon, in
// welcher Sprache der Rohwert in der DB gespeichert ist (z.B. ältere
// Testdaten mit deutschen Kategorienamen). Der Rohwert bleibt für
// Filter-Logik/DB unverändert -> nur die Anzeige wird übersetzt.
const CATEGORY_LABELS: Record<string, string> = {
  'Essen': 'Food',
  'Getränke': 'Drinks',
  'Umfrage': 'Survey',
  'Reisen': 'Travel',
};

export function categoryLabel(category: string | undefined | null): string {
  if (!category) return '';
  return CATEGORY_LABELS[category] ?? category;
}
