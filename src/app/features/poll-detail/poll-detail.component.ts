import { Component, OnInit, signal, WritableSignal } from '@angular/core';
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
  poll: WritableSignal<Poll | undefined> = signal<Poll | undefined>(undefined);
  loading = signal(false);
  submitting = signal(false);
  hasVoted = signal(false);

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

  getTotalVotes(): number {
    const currentPoll = this.poll();
    if (!currentPoll?.questions) return 0;
    let total = 0;
    currentPoll.questions.forEach(q => {
      if (q.answers) {
        q.answers.forEach(a => total += a.votes);
      }
    });
    return total;
  }

  getPercentage(votes: number): number {
    const total = this.getTotalVotes();
    return total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  hasResults(): boolean {
    const currentPoll = this.poll();
    if (!currentPoll?.questions) return false;
    let hasVotes = false;
    currentPoll.questions.forEach(q => {
      if (q.answers) {
        q.answers.forEach(a => {
          if (a.votes > 0) hasVotes = true;
        });
      }
    });
    return hasVotes;
  }

  vote(answerId: number): void {
    if (this.hasVoted()) return;
    this.submitting.set(true);
    this.pollService.vote(answerId).then(() => {
      this.hasVoted.set(true);
      this.submitting.set(false);
      const currentId = this.poll()?.id;
      if (currentId) {
        this.loadPoll(currentId);
      }
    }).catch(err => {
      console.error('Fehler beim Abstimmen:', err);
      this.submitting.set(false);
    });
  }

  completeSurvey(): void {
    const p = this.poll();
    if (!p || this.submitting()) return;

    const answerIds: number[] = [];
    Object.values(this.selectedAnswers).forEach(set => answerIds.push(...set));

    if (answerIds.length === 0) {
      alert('Please select at least one answer!');
      return;
    }

    this.submitting.set(true);
    Promise.all(answerIds.map(id => this.pollService.vote(id)))
      .then(() => {
        this.selectedAnswers = {};
        if (p.id) this.loadPoll(p.id);
        this.hasVoted.set(true);
      })
      .catch(err => console.error('Fehler beim Abstimmen:', err))
      .finally(() => this.submitting.set(false));
  }
}