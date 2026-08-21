import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { PollService } from '../../shared/services/poll.service';
import { Poll } from '../../shared/models/poll.model';

@Component({
  selector: 'app-poll-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './poll-list.component.html',
  styleUrls: ['./poll-list.component.scss']
})
export class PollListComponent implements OnInit {
  polls: Poll[] = [];
  endingSoonPolls: Poll[] = [];
  filter: 'active' | 'past' = 'active';
  loading = false;

  get filteredPolls(): Poll[] {
    return this.polls.filter(poll =>
      this.filter === 'active' ? poll.is_active : !poll.is_active
    );
  }

  constructor(
    private pollService: PollService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPolls();
    this.loadEndingSoon();
  }

  loadPolls(): void {
    this.loading = true;
    this.pollService.getPolls().subscribe({
      next: (data) => {
        this.polls = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Fehler beim Laden der Umfragen:', err);
        this.loading = false;
        this.polls = [];
      }
    });
  }

  loadEndingSoon(): void {
    this.pollService.getEndingSoonPolls().subscribe({
      next: (data) => {
        this.endingSoonPolls = data || [];
      },
      error: (err) => {
        console.error('Fehler beim Laden der "Ending Soon" Umfragen:', err);
        this.endingSoonPolls = [];
      }
    });
  }

  setFilter(value: 'active' | 'past'): void {
    this.filter = value;
  }

  goToDetail(pollId: number): void {
    this.router.navigate(['/poll', pollId]);
  }

  deletePoll(id: number): void {
    if (confirm('Möchtest du diese Umfrage wirklich löschen?')) {
      this.pollService.deletePoll(id).then(() => {
        this.loadPolls();
      }).catch(err => {
        console.error('Fehler beim Löschen:', err);
      });
    }
  }

  getTotalVotes(poll: Poll): number {
    if (!poll.questions) return 0;
    let total = 0;
    poll.questions.forEach(q => {
      if (q.answers) {
        q.answers.forEach(a => total += a.votes);
      }
    });
    return total;
  }

  getDaysLeft(endDate: string | undefined): number {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getDaysLabel(endDate: string | undefined): string {
    const days = this.getDaysLeft(endDate);
    if (days <= 0) return 'Ends today';
    return days === 1 ? 'Ends in 1 day' : `Ends in ${days} days`;
  }
}