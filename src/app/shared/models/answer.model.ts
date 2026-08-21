export interface Answer {
  id: number;
  question_id: number;
  answer_text: string;
  votes: number;
}

export interface CreateAnswerPayload {
  answer_text: string;
}
