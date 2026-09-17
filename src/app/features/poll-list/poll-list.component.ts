import { Component, OnInit, OnDestroy, signal, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PollService } from '../../shared/services/poll.service';
import { Poll } from '../../shared/models/poll.model';
import { PollCreateComponent } from '../poll-create/poll-create.component';
import { categoryLabel } from '../../shared/utils/category-label';

@Component({
  selector: 'app-poll-list',
  standalone: true,
  imports: [CommonModule, RouterModule, PollCreateComponent],
  templateUrl: './poll-list.component.html',
  styleUrls: ['./poll-list.component.scss']
})
export class PollListComponent implements OnInit, OnDestroy {
  // Signals
  polls = signal<Poll[]>([]);
  endingSoonPolls = signal<Poll[]>([]);
  filter = signal<'active' | 'past'>('active');
  categoryFilter = signal<string>('all');
  loading = signal(false);
  showCreateModal = signal(false);
  categoryDropdownOpen = signal(false);

  // Zeigt Kategorien im Template einheitlich auf Englisch an (Rohwert
  // bleibt für Filter-Logik/DB unverändert, siehe category-label.ts).
  readonly categoryLabel = categoryLabel;

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
    private route: ActivatedRoute,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.loadPolls();
    this.loadEndingSoon();

    // Öffnet das "New Survey"-Overlay automatisch, wenn von woanders
    // (z.B. der Single Survey View) mit ?create=true verlinkt wurde.
    if (this.route.snapshot.queryParamMap.get('create')) {
      this.openCreateModal();
    }
  }

  // Schließt Dropdown bei Klick außerhalb
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.categoryDropdownOpen()) return;
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.setDropdownOpen(false);
    }
  }

  ngOnDestroy(): void {
    // Falls die Komponente (z.B. durch Navigation) zerstört wird, während
    // das Dropdown offen ist, Body-Scroll-Sperre + Wheel-Blocker sicher
    // wieder aufheben.
    this.setBodyScrollLocked(false);
    this.removeWheelBlocker();
  }

  // Zusätzliche, harte Absicherung gegen Scroll-Chaining: solange das
  // Dropdown offen ist, wird jedes Wheel-Event außerhalb des Dropdown-Menüs
  // unterdrückt, damit die Homepage garantiert nicht mitscrollt (die
  // body/html-overflow-Sperre allein reicht in manchen Umgebungen nicht).
  // Muss manuell (nicht als @HostListener) registriert werden, da Angular
  // 'wheel'-Listener standardmäßig als passiv registriert -> preventDefault()
  // würde sonst stillschweigend ignoriert.
  private wheelBlocker = (event: WheelEvent): void => {
    const target = event.target as Node;
    const menu = this.elementRef.nativeElement.querySelector('.category-dropdown__menu');
    if (!menu || !menu.contains(target)) {
      event.preventDefault();
    }
  };

  private addWheelBlocker(): void {
    document.addEventListener('wheel', this.wheelBlocker, { passive: false });
  }

  private removeWheelBlocker(): void {
    document.removeEventListener('wheel', this.wheelBlocker);
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
    this.setDropdownOpen(!this.categoryDropdownOpen());
  }

  closeCategoryDropdown(): void {
    this.setDropdownOpen(false);
  }

  selectCategory(value: string): void {
    this.setCategoryFilter(value);
    this.setDropdownOpen(false);
  }

  // Verhindert Scroll-Chaining: bei offenem Dropdown scrollt die Homepage
  // im Hintergrund nicht mit, wenn im (eigenständig scrollbaren)
  // Dropdown-Menü ans Ende gescrollt wird.
  private setDropdownOpen(open: boolean): void {
    this.categoryDropdownOpen.set(open);
    this.setBodyScrollLocked(open);
    if (open) {
      this.addWheelBlocker();
    } else {
      this.removeWheelBlocker();
    }
  }

  private setBodyScrollLocked(locked: boolean): void {
    // Je nach Browser ist nicht <body>, sondern <html> das tatsächlich
    // scrollende Element -> beide sperren, damit garantiert nichts
    // durchscrollt, während das Dropdown geöffnet ist.
    document.documentElement.style.overflow = locked ? 'hidden' : '';
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  // Zusätzliche Absicherung gegen Scroll-Chaining auf Trackpads: verhindert,
  // dass ein Wheel-Event aus dem Dropdown-Menü auf die Seite durchschlägt.
  onDropdownWheel(event: WheelEvent): void {
    event.stopPropagation();
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