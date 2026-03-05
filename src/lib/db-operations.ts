'use server';

import { supabase } from './supabase-client';
import type { Session, DictionaryEntry, DailyProgress, UserPreferences, TranscriptEntry } from './types';

// Database row types (snake_case from Supabase)
interface SessionRow {
  id: string;
  user_id: string;
  language: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  scenario: string | null;
  transcript: TranscriptEntry[];
  created_at: string;
}

interface DictionaryRow {
  id: string;
  user_id: string;
  language: string;
  term: string;
  meaning: string | null;
  example: string | null;
  scenario: string | null;
  created_at: string;
}

interface ProgressRow {
  id: string;
  user_id: string;
  language: string;
  date: string;
  seconds_spoken: number;
  new_words_count: number;
  created_at: string;
}

interface PreferencesRow {
  id: string;
  user_id: string;
  language: string;
  level: string;
  dialect: string | null;
  daily_goal_minutes: number;
  created_at: string;
  updated_at: string;
}

// ============ MAPPINGS ============

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    durationSeconds: row.duration_seconds,
    scenario: row.scenario || undefined,
    transcript: row.transcript,
    createdAt: new Date(row.created_at),
  };
}

function rowToDictionaryEntry(row: DictionaryRow): DictionaryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language,
    term: row.term,
    meaning: row.meaning || undefined,
    example: row.example || undefined,
    scenario: row.scenario || undefined,
    createdAt: new Date(row.created_at),
  };
}

function rowToDailyProgress(row: ProgressRow): DailyProgress {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language,
    date: row.date,
    secondsSpoken: row.seconds_spoken,
    newWordsCount: row.new_words_count,
    createdAt: new Date(row.created_at),
  };
}

function rowToUserPreferences(row: PreferencesRow): UserPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language,
    level: row.level as 'beginner' | 'intermediate' | 'advanced',
    dialect: row.dialect || '',
    dailyGoalMinutes: row.daily_goal_minutes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============ SESSIONS ============

export async function createSession(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: session.userId,
      language: session.language,
      started_at: session.startedAt.toISOString(),
      ended_at: session.endedAt?.toISOString(),
      duration_seconds: session.durationSeconds,
      scenario: session.scenario,
      transcript: session.transcript,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToSession(data as SessionRow);
}

export async function getUserSessions(userId: string, limit: number = 10): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as SessionRow[]).map(rowToSession);
}

// ============ DICTIONARY ============

export async function addDictionaryEntry(entry: {
  userId: string;
  language: string;
  term: string;
  meaning?: string;
  example?: string;
  scenario?: string;
}): Promise<DictionaryEntry> {
  const { data, error } = await supabase
    .from('dictionary_entries')
    .insert({
      user_id: entry.userId,
      language: entry.language,
      term: entry.term,
      meaning: entry.meaning,
      example: entry.example,
      scenario: entry.scenario,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToDictionaryEntry(data as DictionaryRow);
}

export async function getDictionaryEntries(userId: string, language?: string): Promise<DictionaryEntry[]> {
  let query = supabase
    .from('dictionary_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (language) {
    query = query.eq('language', language);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data as DictionaryRow[]).map(rowToDictionaryEntry);
}

export async function deleteDictionaryEntry(entryId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('dictionary_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ============ USER PROGRESS ============

export async function getTodayProgress(userId: string, language: string): Promise<DailyProgress | null> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language)
    .eq('date', today)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToDailyProgress(data as ProgressRow) : null;
}

export async function upsertProgress(
  userId: string,
  language: string,
  secondsToAdd: number,
  wordsToAdd: number = 0
): Promise<DailyProgress> {
  const today = new Date().toISOString().split('T')[0];

  // Try to get existing progress
  const { data: existing, error: fetchError } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language)
    .eq('date', today)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    const row = existing as ProgressRow;
    // Update existing
    const { data, error } = await supabase
      .from('user_progress')
      .update({
        seconds_spoken: row.seconds_spoken + secondsToAdd,
        new_words_count: row.new_words_count + wordsToAdd,
      })
      .eq('id', row.id)
      .select()
      .single();

    if (error) throw error;
    return rowToDailyProgress(data as ProgressRow);
  } else {
    // Create new
    const { data, error } = await supabase
      .from('user_progress')
      .insert({
        user_id: userId,
        language: language,
        date: today,
        seconds_spoken: secondsToAdd,
        new_words_count: wordsToAdd,
      })
      .select()
      .single();

    if (error) throw error;
    return rowToDailyProgress(data as ProgressRow);
  }
}

export async function getWeeklyProgress(userId: string, language: string): Promise<DailyProgress[]> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('language', language)
    .gte('date', weekAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) throw error;
  return (data as ProgressRow[]).map(rowToDailyProgress);
}

// ============ STREAK CALCULATION ============

export async function getStreakInfo(userId: string, language: string): Promise<{ current: number; best: number }> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('date')
    .eq('user_id', userId)
    .eq('language', language)
    .gt('seconds_spoken', 0)
    .order('date', { ascending: false })
    .limit(365);

  if (error) throw error;

  if (!data || data.length === 0) {
    return { current: 0, best: 0 };
  }

  const dates = data.map((p) => p.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = new Date(dates[i]);
    date.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (date.getTime() === expectedDate.getTime()) {
      tempStreak++;
      currentStreak = tempStreak;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      break;
    }
  }

  return { current: currentStreak, best: bestStreak };
}

// ============ USER PREFERENCES ============

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToUserPreferences(data as PreferencesRow) : null;
}

export async function upsertUserPreferences(
  userId: string,
  preferences: Partial<Omit<UserPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      language: preferences.language,
      level: preferences.level,
      dialect: preferences.dialect,
      daily_goal_minutes: preferences.dailyGoalMinutes,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return rowToUserPreferences(data as PreferencesRow);
}
