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
  selectedAnswers: Record<number, Set<number>> = {};

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
        this.selectedAnswers = {};
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

  toggleAnswer(questionId: number, answerId: number, allowMultiple: boolean): void {
    const poll = this.poll();
    if (!poll?.is_active) return; // Past Surveys sind nicht mehr interaktiv

    const set = this.selectedAnswers[questionId] ?? new Set<number>();
    if (allowMultiple) {
      set.has(answerId) ? set.delete(answerId) : set.add(answerId);
    } else {
      set.clear();
      set.add(answerId);
    }
    this.selectedAnswers[questionId] = set;
  }

  isSelected(questionId: number, answerId: number): boolean {
    return this.selectedAnswers[questionId]?.has(answerId) ?? false;
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
    return p.questions.some((q: Question) =>
      (q.answers ?? []).some((a: Answer) => a.votes > 0)
    );
  }

  questionTotalVotes(answers: Answer[] | undefined): number {
    return (answers ?? []).reduce((sum, a) => sum + (a.votes ?? 0), 0);
  }

  votePercentage(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
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

  completeSurvey(): void {
    const p = this.poll();
    if (!p || !p.is_active || this.submitting()) return;

    const answerIds: number[] = [];
    Object.values(this.selectedAnswers).forEach(set => answerIds.push(...set));

    if (answerIds.length === 0) return;

    this.submitting.set(true);

    // Optimistisches Update: Stimmen sofort lokal hochzählen, damit die
    // Balken ohne spürbare Verzögerung reagieren, bevor die Bestätigung
    // von Supabase (bzw. der Realtime-Push) zurückkommt.
    this.applyOptimisticVotes(answerIds);

    Promise.all(answerIds.map(id => this.pollService.vote(id)))
      .then(() => {
        this.selectedAnswers = {};
        if (p.id) this.loadPoll(p.id);
      })
      .catch(err => {
        console.error('Fehler beim Abstimmen:', err);
        if (p.id) this.loadPoll(p.id); // bei Fehler auf den echten Stand zurücksetzen
      })
      .finally(() => this.submitting.set(false));
  }

  private applyOptimisticVotes(answerIds: number[]): void {
    const current = this.poll();
    if (!current?.questions) return;

    const idSet = new Set(answerIds);
    const updated: Poll = {
      ...current,
      questions: current.questions.map(q => ({
        ...q,
        answers: (q.answers ?? []).map(a =>
          idSet.has(a.id) ? { ...a, votes: (a.votes ?? 0) + 1 } : a
        )
      }))
    };
    this.poll.set(updated);
  }
}
