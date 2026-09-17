import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PollService } from '../../shared/services/poll.service';
import { Poll } from '../../shared/models/poll.model';
import { Question } from '../../shared/models/question.model';
import { Answer } from '../../shared/models/answer.model';

@Component({
  selector: 'app-poll-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './poll-detail.component.html',
  styleUrls: ['./poll-detail.component.scss']
})
export class PollDetailComponent implements OnInit, OnDestroy {
  poll = signal<Poll | undefined>(undefined);
  loading = signal(false);
  submitting = signal(false);
  // Mobile-only: steuert Ein-/Ausklappen des "Survey results"-Bereichs
  // über den "Close results" / "Show results" Button (Figma Mobile View).
  resultsOpen = signal(true);

  answerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Live-Vorschau (Feature: "Live Result Vorschau"): hält pro Frage die
  // gerade angeklickten, aber NICHT gespeicherten Antwort-IDs.
  // -> ausschließlich In-Memory-State, kein Supabase-Call beim Klicken.
  // Erst completeSurvey() schreibt diese Auswahl tatsächlich in die DB.
  localPreviewAnswers: Record<number, number[]> = {};

  private answerChannel?: RealtimeChannel;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pollService: PollService
  ) {}

  ngOnInit(): void {
    // paramMap statt snapshot: läuft auch dann sauber, wenn Angular die
    // Komponente bei einem Wechsel von /poll/:id auf /poll/:andereId
    // wiederverwendet, statt sie neu zu erzeugen.
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.localPreviewAnswers = {};
        this.loadPoll(id);
        this.subscribeToLiveUpdates(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.pollService.unsubscribeChannel(this.answerChannel);
  }

  loadPoll(id: number): void {
    this.loading.set(true);
    this.pollService.getPollById(id).subscribe({
      next: (data) => {
        this.poll.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der Umfrage:', err);
        this.loading.set(false);
      }
    });
  }

  // User Story 5: Ergebnisse aktualisieren sich live (User Story 5 / Task 3),
  // sobald sich Stimmen in Supabase ändern – auch wenn eine andere Person in
  // einem anderen Tab/Browser abstimmt. Voraussetzung in Supabase: die
  // "answers"-Tabelle muss der Realtime-Publikation hinzugefügt sein
  // (Database -> Replication -> answers aktivieren).
  private subscribeToLiveUpdates(pollId: number): void {
    this.pollService.unsubscribeChannel(this.answerChannel);
    this.answerChannel = this.pollService.subscribeToAnswerChanges(pollId, () => {
      this.pollService.getPollById(pollId).subscribe({
        next: (data) => this.poll.set(data),
        error: (err) => console.error('Fehler beim Live-Update:', err)
      });
    });
  }

  // Klick auf eine Option: nur lokalen Preview-State togglen.
  // KEIN Supabase-Call / kein Optimistic Update in der DB an dieser Stelle.
  toggleAnswer(questionId: number, answerId: number, allowMultiple: boolean): void {
    const poll = this.poll();
    if (!poll?.is_active) return; // Past Surveys sind nicht mehr interaktiv

    const current = this.localPreviewAnswers[questionId] ?? [];
    if (allowMultiple) {
      this.localPreviewAnswers[questionId] = current.includes(answerId)
        ? current.filter(id => id !== answerId)
        : [...current, answerId];
    } else {
      this.localPreviewAnswers[questionId] = [answerId];
    }
  }

  isSelected(questionId: number, answerId: number): boolean {
    return this.localPreviewAnswers[questionId]?.includes(answerId) ?? false;
  }

  // Task 1: feste, konsistente Reihenfolge der Antwortoptionen (A, B, C, D...)
  // unabhängig von der Stimmenzahl. Sortiert stabil nach answer.id
  // (aufsteigend = Erstellungsreihenfolge, also exakt A vor B vor C ...).
  // Wird sowohl für die Abstimmungs-Optionen als auch für das
  // Balkendiagramm verwendet, damit beide Seiten immer synchron sind.
  sortedAnswers(question: Question): Answer[] {
    return [...(question.answers ?? [])].sort((a: Answer, b: Answer) => a.id - b.id);
  }

  hasResults(): boolean {
    const p = this.poll();
    if (!p?.questions) return false;
    const hasStoredVotes = p.questions.some((q: Question) =>
      (q.answers ?? []).some((a: Answer) => a.votes > 0)
    );
    const hasPendingPreview = Object.values(this.localPreviewAnswers).some(ids => ids.length > 0);
    return hasStoredVotes || hasPendingPreview;
  }

  questionTotalVotes(answers: Answer[] | undefined): number {
    return (answers ?? []).reduce((sum, a) => sum + (a.votes ?? 0), 0);
  }

  votePercentage(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  // Live-Vorschau: bestehende DB-Votes + lokale (noch nicht gespeicherte)
  // Preview-Auswahl. Reine Berechnung für die Anzeige, kein Schreibzugriff.
  previewVotes(questionId: number, answer: Answer): number {
    const isPending = this.localPreviewAnswers[questionId]?.includes(answer.id) ?? false;
    return answer.votes + (isPending ? 1 : 0);
  }

  previewTotal(questionId: number, answers: Answer[] | undefined): number {
    const base = this.questionTotalVotes(answers);
    return base + (this.localPreviewAnswers[questionId]?.length ?? 0);
  }

  // TrackBy-Funktionen: verhindern, dass Angular bei jedem Live-Update
  // (Realtime-Push) die kompletten Frage-/Antwort-DOM-Knoten neu aufbaut –
  // dadurch bleiben z.B. Balken-Transitions sauber und flackerfrei.
  trackByQuestion(_index: number, question: Question): number {
    return question.id;
  }

  trackByAnswer(_index: number, answer: Answer): number {
    return answer.id;
  }

  // Mobile-only: Close-Button oben rechts neben "Published" -> zurück zur
  // Übersicht (poll-list).
  closeSurvey(): void {
    this.router.navigate(['/']);
  }

  // Mobile-only: "Close results" / "Show results" Toggle.
  toggleResults(): void {
    this.resultsOpen.update(open => !open);
  }

  // Erst hier werden die Preview-Antworten tatsächlich in Supabase
  // gespeichert (ein Insert/Increment pro ausgewählter Antwort-ID).
  completeSurvey(): void {
    const p = this.poll();
    if (!p || !p.is_active || this.submitting()) return;

    const answerIds: number[] = Object.values(this.localPreviewAnswers).flat();
    if (answerIds.length === 0) return;

    this.submitting.set(true);

    Promise.all(answerIds.map(id => this.pollService.vote(id)))
      .then(() => {
        this.localPreviewAnswers = {};
        if (p.id) this.loadPoll(p.id); // echte, gespeicherte Werte nachladen
      })
      .catch(err => {
        console.error('Fehler beim Abstimmen:', err);
      })
      .finally(() => this.submitting.set(false));
  }
}
