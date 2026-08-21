import { Question, CreateQuestionPayload } from './question.model';

export interface Poll {
  id: number;
  title: string;
  description?: string;
  category?: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  questions?: Question[];
  totalVotes?: number;
}

export interface CreatePollPayload {
  title: string;
  description?: string;
  category?: string;
  end_date?: string;
  questions: CreateQuestionPayload[];
}
