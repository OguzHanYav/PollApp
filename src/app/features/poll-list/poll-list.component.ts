import { Component, OnInit, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { PollService } from '../../shared/services/poll.service';
import { Poll } from '../../shared/models/poll.model';
import { PollCreateComponent } from '../poll-create/poll-create.component';

@Component({
  selector: 'app-poll-list',
  standalone: true,
  imports: [CommonModule, RouterModule, PollCreateComponent],
  templateUrl: './poll-list.component.html',
  styleUrls: ['./poll-list.component.scss']
})
export class PollListComponent implements OnInit {
  // Signals
  polls = signal<Poll[]>([]);
  endingSoonPolls = signal<Poll[]>([]);
  filter = signal<'active' | 'past'>('active');
  categoryFilter = signal<string>('all');
  loading = signal(false);
  showCreateModal = signal(false);
  categoryDropdownOpen = signal(false);

  // Kategorien dynamisch aus vorhandenen Umfragen
  categories = computed(() => {
    const cats = new Set(
      this.polls()
        .map(p => p.category)
        .filter((c): c is string => !!c)
    );
    return Array.from(cats).sort();
  });

  // Kombinierter Filter: Tab + Kategorie
  filteredPolls = computed(() => {
    const tab = this.filter();
    const category = this.categoryFilter();
    return this.polls().filter(poll => {
      const tabMatch = tab === 'active' ? poll.is_active : !poll.is_active;
      const categoryMatch = category === 'all' || poll.category === category;
      return tabMatch && categoryMatch;
    });
  });

  constructor(
    private pollService: PollService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.loadPolls();
    this.loadEndingSoon();
  }

  // Schließt Dropdown bei Klick außerhalb
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.categoryDropdownOpen()) return;
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.categoryDropdownOpen.set(false);
    }
  }

  loadPolls(): void {
    this.loading.set(true);
    this.pollService.getPolls().subscribe({
      next: (data) => {
        this.polls.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der Umfragen:', err);
        this.loading.set(false);
      }
    });
  }

  loadEndingSoon(): void {
    this.pollService.getEndingSoonPolls().subscribe({
      next: (data) => {
        this.endingSoonPolls.set(data);
      },
      error: (err) => {
        console.error('Fehler beim Laden der "Ending Soon" Umfragen:', err);
      }
    });
  }

  setFilter(value: 'active' | 'past'): void {
    this.filter.set(value);
    this.categoryFilter.set('all');
  }

  setCategoryFilter(value: string): void {
    this.categoryFilter.set(value);
  }

  // --- Kategorie-Dropdown ---
  toggleCategoryDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.categoryDropdownOpen.update(open => !open);
  }

  closeCategoryDropdown(): void {
    this.categoryDropdownOpen.set(false);
  }

  selectCategory(value: string): void {
    this.setCategoryFilter(value);
    this.categoryDropdownOpen.set(false);
  }

  deletePoll(id: number): void {
    if (confirm('Möchtest du diese Umfrage wirklich löschen?')) {
      this.pollService.deletePoll(id).then(() => {
        this.loadPolls();
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

  // --- Create-Modal ---
  openCreateModal(): void {
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  onPollCreated(pollId: number): void {
    this.showCreateModal.set(false);
    this.loadPolls();
    this.loadEndingSoon();
    this.router.navigate(['/poll', pollId]);
  }
}