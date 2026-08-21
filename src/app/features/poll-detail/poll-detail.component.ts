

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PollService } from '../../shared/services/poll.service';
import { Poll } from '../../shared/models/poll.model';

@Component({
  selector: 'app-poll-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './poll-detail.component.html',
  styleUrls: ['./poll-detail.component.scss']
})
export class PollDetailComponent implements OnInit {
  poll = signal<Poll | undefined>(undefined);
  loading = signal(false);
  submitting = signal(false);

  answerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  selectedAnswers: Record<number, Set<number>> = {};

  constructor(
    private route: ActivatedRoute,
    private pollService: PollService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadPoll(id);
    }
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

  toggleAnswer(questionId: number, answerId: number, allowMultiple: boolean): void {
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
    if (!p || this.submitting()) return;

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



