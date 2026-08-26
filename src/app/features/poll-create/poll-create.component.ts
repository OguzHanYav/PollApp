import { Component, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PollService } from '../../shared/services/poll.service';

// PollCreateComponent ist jetzt eine eigene Route (/create) statt
// Overlay/Modal. Navigation läuft daher über den Router statt über
// (closed)/(created) EventEmitter zum Parent.
@Component({
  selector: 'app-poll-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './poll-create.component.html',
  styleUrls: ['./poll-create.component.scss']
})
export class PollCreateComponent {
  surveyForm: FormGroup;

  showPublishOverlay = signal(false);
  createdPollId = signal<number | undefined>(undefined);

  // Custom "Choose Category"-Dropdown (gleiches Verhalten wie
  // "Sort by categories" in PollListComponent)
  categoryOptions: string[] = [
    'Feedback',
    'Market Research',
    'Employee Satisfaction',
    'Customer Service',
    'Product',
    'Other'
  ];
  categoryDropdownOpen = signal(false);

  constructor(
    private fb: FormBuilder,
    private pollService: PollService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>
  ) {
    this.surveyForm = this.fb.group({
      title: ['', Validators.required],
      category: ['', Validators.required],
      description: [''],
      end_date: [''],
      questions: this.fb.array([this.createQuestionBlock()])
    });
  }

  get questions(): FormArray {
    return this.surveyForm.get('questions') as FormArray;
  }

  // Schließt das Category-Dropdown bei Klick außerhalb
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.categoryDropdownOpen()) return;
    const target = event.target as Node;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.categoryDropdownOpen.set(false);
    }
  }

  toggleCategoryDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.categoryDropdownOpen.update(open => !open);
  }

  selectCategory(value: string): void {
    const control = this.surveyForm.get('category');
    control?.setValue(value);
    control?.markAsTouched();
    this.categoryDropdownOpen.set(false);
  }

  createQuestionBlock(): FormGroup {
    return this.fb.group({
      question_text: ['', Validators.required],
      allow_multiple: [false],
      answers: this.fb.array([this.createAnswerField(), this.createAnswerField()])
    });
  }

  createAnswerField(): FormGroup {
    return this.fb.group({
      answer_text: ['', Validators.required]
    });
  }

  getAnswers(questionIndex: number): FormArray {
    return this.questions.at(questionIndex).get('answers') as FormArray;
  }

  getAnswerLetter(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, ...
  }

  addAnswer(questionIndex: number): void {
    this.getAnswers(questionIndex).push(this.createAnswerField());
  }

  addQuestion(): void {
    this.questions.push(this.createQuestionBlock());
  }

  removeQuestion(index: number): void {
    if (index === 0) {
      const question = this.questions.at(index) as FormGroup;
      question.get('question_text')?.setValue('');
      const answers = question.get('answers') as FormArray;
      while (answers.length > 0) {
        answers.removeAt(0);
      }
      answers.push(this.createAnswerField());
      answers.push(this.createAnswerField());
    } else {
      this.questions.removeAt(index);
    }
  }

  removeAnswer(questionIndex: number, answerIndex: number): void {
    const answers = this.getAnswers(questionIndex);
    if (answers.length > 2) {
      answers.removeAt(answerIndex);
    }
  }

  clearField(controlName: 'title' | 'description' | 'end_date'): void {
    this.surveyForm.get(controlName)?.setValue('');
  }

  onSubmit(): void {
    if (this.surveyForm.invalid) {
      Object.keys(this.surveyForm.controls).forEach(key => {
        const control = this.surveyForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    const formValue = this.surveyForm.value;
    this.pollService.createPoll(formValue).then((poll) => {
      this.createdPollId.set(poll.id);
      this.showPublishOverlay.set(true);
    }).catch(err => {
      console.error('Fehler beim Erstellen der Umfrage:', err);
    });
  }

  cancel(): void {
    this.router.navigate(['/']);
  }

  closeOverlay(): void {
    this.showPublishOverlay.set(false);
    const id = this.createdPollId();
    if (id) {
      this.router.navigate(['/poll', id]);
    } else {
      this.router.navigate(['/']);
    }
  }
  
}
