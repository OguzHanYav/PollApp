import { Answer, CreateAnswerPayload } from './answer.model';

export interface Question {
  id: number;
  poll_id: number;
  question_text: string;
  allow_multiple: boolean;
  answers?: Answer[];
}

export interface CreateQuestionPayload {
  question_text: string;
  allow_multiple: boolean;
  answers: CreateAnswerPayload[];
}
