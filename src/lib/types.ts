// TalkTutor Data Types

// User Preferences
export interface UserPreferences {
  id: string;
  userId: string;
  language: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  dialect: string;
  dailyGoalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

// Session (call log)
export interface Session {
  id: string;
  userId: string;
  language: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  scenario?: string;
  transcript?: TranscriptEntry[];
  createdAt: Date;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  correction?: Correction;
}

export interface Correction {
  original: string;
  corrected: string;
  explanation?: string;
}

// Dictionary Entry
export interface DictionaryEntry {
  id: string;
  userId: string;
  language: string;
  term: string;
  meaning?: string;
  example?: string;
  scenario?: string;
  createdAt: Date;
}

// User Progress (daily)
export interface DailyProgress {
  id: string;
  userId: string;
  language: string;
  date: string; // YYYY-MM-DD
  secondsSpoken: number;
  newWordsCount: number;
  createdAt: Date;
}

// Streak Info
export interface StreakInfo {
  current: number;
  best: number;
}

// Language Options
export const LANGUAGES = [
  { code: 'spanish', name: 'Spanish', dialects: ['Spain (Barcelona)', 'Latin America', 'Mexico', 'Argentina'] },
  { code: 'french', name: 'French', dialects: ['France (Paris)', 'Canada (Quebec)', 'West Africa'] },
  { code: 'german', name: 'German', dialects: ['Germany (Standard)', 'Austria', 'Switzerland'] },
  { code: 'italian', name: 'Italian', dialects: ['Italy (Standard)', 'Switzerland'] },
  { code: 'portuguese', name: 'Portuguese', dialects: ['Brazil', 'Portugal'] },
  { code: 'japanese', name: 'Japanese', dialects: ['Standard'] },
  { code: 'korean', name: 'Korean', dialects: ['Standard'] },
  { code: 'mandarin', name: 'Mandarin Chinese', dialects: ['Mainland (Beijing)', 'Taiwan', 'Singapore'] },
] as const;

export const LEVELS = [
  { code: 'beginner', name: 'Beginner', description: 'Just starting out' },
  { code: 'intermediate', name: 'Intermediate', description: 'Can hold basic conversations' },
  { code: 'advanced', name: 'Advanced', description: 'Comfortable with complex topics' },
] as const;

// Scenarios
export const SCENARIOS = [
  { id: 'cafe', name: 'Ordering at a café', icon: '☕' },
  { id: 'restaurant', name: 'Restaurant reservation', icon: '🍽️' },
  { id: 'meeting', name: 'Meeting new people', icon: '👋' },
  { id: 'directions', name: 'Directions / transit', icon: '🗺️' },
  { id: 'doctor', name: 'Doctor / pharmacy', icon: '🏥' },
  { id: 'apartment', name: 'Apartment viewing', icon: '🏠' },
  { id: 'shopping', name: 'Shopping at a market', icon: '🛒' },
  { id: 'hotel', name: 'Hotel check-in', icon: '🛏️' },
  { id: 'random', name: 'Surprise me!', icon: '🎲' },
] as const;

// Session state for voice call
export type SessionStatus = 'idle' | 'connecting' | 'active' | 'paused' | 'ended';

export interface VoiceSessionState {
  status: SessionStatus;
  durationSeconds: number;
  scenario?: string;
  transcript: TranscriptEntry[];
  corrections: Correction[];
  newWords: Omit<DictionaryEntry, 'id' | 'userId' | 'createdAt'>[];
}

// Trial state
export interface TrialState {
  isTrial: boolean;
  used: boolean;
  remaining: number; // seconds
  expired: boolean;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Google Live API types
export interface LiveApiConfig {
  model: string;
  voice: {
    name: string;
  };
  systemInstruction: string;
}

export interface LiveApiMessage {
  role: 'user' | 'model';
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
}
