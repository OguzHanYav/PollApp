import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { PollService } from '../../shared/services/poll.service';

@Component({
  selector: 'app-poll-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './poll-create.component.html',
  styleUrls: ['./poll-create.component.scss']
})
export class PollCreateComponent {
  surveyForm: FormGroup;
  showPublishOverlay = false;
  createdPollId?: number;

  constructor(
    private fb: FormBuilder,
    private pollService: PollService,
    private router: Router
  ) {
    this.surveyForm = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      end_date: ['', Validators.required],
      category: ['', Validators.required],
      questions: this.fb.array([this.createQuestionBlock()])
    });
  }

  get questions(): FormArray {
    return this.surveyForm.get('questions') as FormArray;
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
      this.createdPollId = poll.id;
      this.showPublishOverlay = true;
    }).catch(err => {
      console.error('Fehler beim Erstellen der Umfrage:', err);
    });
  }

  closeOverlay(): void {
    this.showPublishOverlay = false;
    if (this.createdPollId) {
      this.router.navigate(['/poll', this.createdPollId]);
    }
  }
}
