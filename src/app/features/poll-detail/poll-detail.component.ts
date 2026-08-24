import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PollService } from '../../shared/services/poll.service';
import { Poll } from '../../shared/models/poll.model';

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

  answerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  selectedAnswers: Record<number, Set<number>> = {};

  private answerChannel?: RealtimeChannel;

  constructor(
    private route: ActivatedRoute,
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

  // User Story 5: Ergebnisse aktualisieren sich live, sobald sich Stimmen
  // ändern (z.B. weil jemand anderes gerade abgestimmt hat).
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

  hasResults(): boolean {
    const p = this.poll();
    if (!p?.questions) return false;
    return p.questions.some((q: any) =>
      (q.answers ?? []).some((a: any) => a.votes > 0)
    );
  }

  questionTotalVotes(answers: any[] | undefined): number {
    return (answers ?? []).reduce((sum, a) => sum + (a.votes ?? 0), 0);
  }

  votePercentage(votes: number, total: number): number {
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  completeSurvey(): void {
    const p = this.poll();
    if (!p || !p.is_active || this.submitting()) return;

    const answerIds: number[] = [];
    Object.values(this.selectedAnswers).forEach(set => answerIds.push(...set));

    if (answerIds.length === 0) return;

    this.submitting.set(true);
    Promise.all(answerIds.map(id => this.pollService.vote(id)))
      .then(() => {
        this.selectedAnswers = {};
        if (p.id) this.loadPoll(p.id);
      })
      .catch(err => console.error('Fehler beim Abstimmen:', err))
      .finally(() => this.submitting.set(false));
  }
}
