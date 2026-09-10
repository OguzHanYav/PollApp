import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Poll, CreatePollPayload } from '../models/poll.model';
import { Question, CreateQuestionPayload } from '../models/question.model';
import { CreateAnswerPayload } from '../models/answer.model';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../../environments/environment';

const ENDING_SOON_LIMIT = 3;

@Injectable({
  providedIn: 'root'
})
export class PollService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  getPolls(): Observable<Poll[]> {
    return from(
      this.supabase
        .from('polls')
        .select(`
          *,
          questions:questions (
            *,
            answers:answers (*)
          )
        `)
        .order('created_at', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data as Poll[];
      })
    );
  }

  getPollById(id: number): Observable<Poll> {
    return from(
      this.supabase
        .from('polls')
        .select(`
          *,
          questions:questions (
            *,
            answers:answers (*)
          )
        `)
        .eq('id', id)
        .single()
    ).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data as Poll;
      })
    );
  }

  // Sortiert aufsteigend nach end_date -> frühestes Ende zuerst (User Story 1)
  getEndingSoonPolls(): Observable<Poll[]> {
    const today = new Date().toISOString().split('T')[0];
    return from(
      this.supabase
        .from('polls')
        .select(`
          *,
          questions:questions (
            *,
            answers:answers (*)
          )
        `)
        .eq('is_active', true)
        .gte('end_date', today)
        .order('end_date', { ascending: true })
        .limit(ENDING_SOON_LIMIT)
    ).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data as Poll[];
      })
    );
  }

  /** Legt eine Umfrage samt Fragen und Antwortoptionen an. */
  async createPoll(pollData: CreatePollPayload): Promise<Poll> {
    const poll = await this.insertPoll(pollData);

    for (const q of pollData.questions) {
      const question = await this.insertQuestion(poll.id, q);
      if (q.answers && q.answers.length > 0) {
        await this.insertAnswers(question.id, q.answers);
      }
    }

    return poll;
  }

  private async insertPoll(pollData: CreatePollPayload): Promise<Poll> {
    const { title, description, category, end_date } = pollData;
    const { data, error } = await this.supabase
      .from('polls')
      .insert({
        title,
        description: description || null,
        category: category || null,
        end_date: end_date || null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data as Poll;
  }

  private async insertQuestion(pollId: number, q: CreateQuestionPayload): Promise<Question> {
    const { data, error } = await this.supabase
      .from('questions')
      .insert({
        poll_id: pollId,
        question_text: q.question_text,
        allow_multiple: q.allow_multiple || false
      })
      .select()
      .single();

    if (error) throw error;
    return data as Question;
  }

  private async insertAnswers(questionId: number, answers: CreateAnswerPayload[]): Promise<void> {
    const payload = answers.map(a => ({
      question_id: questionId,
      answer_text: a.answer_text,
      votes: 0
    }));

    const { error } = await this.supabase.from('answers').insert(payload);
    if (error) throw error;
  }

  // Task 3: Live-Voting. Versucht zuerst die atomare Postgres-Funktion
  // "increment_vote" (siehe Supabase-Hinweis) zu nutzen, um Race Conditions
  // bei gleichzeitigen Stimmen zu vermeiden. Falls die Funktion (noch) nicht
  // existiert, wird auf das bisherige read-then-update Verhalten zurückgefallen.
  async vote(answerId: number): Promise<{ success: boolean }> {
    const { error: rpcError } = await this.supabase.rpc('increment_vote', {
      answer_id: answerId
    });

    if (!rpcError) {
      return { success: true };
    }

    const { data: answer, error: fetchError } = await this.supabase
      .from('answers')
      .select('votes')
      .eq('id', answerId)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await this.supabase
      .from('answers')
      .update({ votes: (answer.votes || 0) + 1 })
      .eq('id', answerId);

    if (updateError) throw updateError;

    return { success: true };
  }

  async deletePoll(id: number): Promise<{ success: boolean }> {
    const { error } = await this.supabase
      .from('polls')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  async togglePollStatus(id: number): Promise<{ success: boolean }> {
    const { data: poll, error: fetchError } = await this.supabase
      .from('polls')
      .select('is_active')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error: updateError } = await this.supabase
      .from('polls')
      .update({ is_active: !poll.is_active })
      .eq('id', id);

    if (updateError) throw updateError;

    return { success: true };
  }

  // --- Realtime (User Story 5 / Task 3: Live-Auswertung) ---
  // Abonniert Änderungen an der answers-Tabelle, damit die Detailansicht
  // ohne manuelles Neuladen aktualisiert werden kann, sobald irgendjemand
  // abstimmt (auch andere Nutzer:innen in anderen Browsertabs).
  subscribeToAnswerChanges(pollId: number, onChange: () => void): RealtimeChannel {
    return this.supabase
      .channel(`poll-${pollId}-answers`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'answers' },
        () => onChange()
      )
      .subscribe();
  }

  unsubscribeChannel(channel: RealtimeChannel | undefined): void {
    if (channel) {
      this.supabase.removeChannel(channel);
    }
  }
}
