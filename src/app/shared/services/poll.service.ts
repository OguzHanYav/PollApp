import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Poll } from '../models/poll.model';
import { Observable, from, map } from 'rxjs';
import { environment } from '../../../environments/environment';

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
        .limit(3)
    ).pipe(
      map(response => {
        if (response.error) throw response.error;
        return response.data as Poll[];
      })
    );
  }

  async createPoll(pollData: any): Promise<any> {
    const { title, description, category, end_date, questions } = pollData;

    const { data: poll, error: pollError } = await this.supabase
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

    if (pollError) throw pollError;

    for (const q of questions) {
      const { data: question, error: questionError } = await this.supabase
        .from('questions')
        .insert({
          poll_id: poll.id,
          question_text: q.question_text,
          allow_multiple: q.allow_multiple || false
        })
        .select()
        .single();

      if (questionError) throw questionError;

      if (q.answers && q.answers.length > 0) {
        const answers = q.answers.map((a: any) => ({
          question_id: question.id,
          answer_text: a.answer_text,
          votes: 0
        }));

        const { error: answersError } = await this.supabase
          .from('answers')
          .insert(answers);

        if (answersError) throw answersError;
      }
    }

    return poll;
  }

  // Task 3: Live-Voting. Versucht zuerst die atomare Postgres-Funktion
  // "increment_vote" (siehe Supabase-Hinweis) zu nutzen, um Race Conditions
  // bei gleichzeitigen Stimmen zu vermeiden. Falls die Funktion (noch) nicht
  // existiert, wird auf das bisherige read-then-update Verhalten zurückgefallen.
  async vote(answerId: number): Promise<any> {
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

  async deletePoll(id: number): Promise<any> {
    const { error } = await this.supabase
      .from('polls')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  async togglePollStatus(id: number): Promise<any> {
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
