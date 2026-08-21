import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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

  constructor(private pollService: PollService) {}

  ngOnInit(): void {
    this.loadPolls();
    this.loadEndingSoon();
  }

  loadPolls(): void {
    this.loading = true;
    this.pollService.getPolls().subscribe({
      next: (data) => {
        this.polls = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Fehler beim Laden der Umfragen:', err);
        this.loading = false;
      }
    });
  }

  loadEndingSoon(): void {
    this.pollService.getEndingSoonPolls().subscribe({
      next: (data) => {
        this.endingSoonPolls = data;
      },
      error: (err) => {
        console.error('Fehler beim Laden der "Ending Soon" Umfragen:', err);
      }
    });
  }

  deletePoll(id: number): void {
    if (confirm('Möchtest du diese Umfrage wirklich löschen?')) {
      this.pollService.deletePoll(id).then(() => {
        this.loadPolls();
      });
    }
  }

  getFilteredPolls(): Poll[] {
    return this.polls.filter(poll => 
      this.filter === 'active' ? poll.is_active : !poll.is_active
    );
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
}