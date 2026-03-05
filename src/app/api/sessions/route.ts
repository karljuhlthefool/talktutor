import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/auth-client';
import {
  createSession,
  upsertProgress,
  addDictionaryEntry,
} from '@/lib/db-operations';
import type { TranscriptEntry } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Get user from auth
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { language, scenario, durationSeconds, transcript, newWords } = body;

    // Create session record
    const session = await createSession({
      userId: user.id,
      language: language || 'Spanish',
      startedAt: new Date(Date.now() - durationSeconds * 1000),
      endedAt: new Date(),
      durationSeconds,
      scenario,
      transcript,
    });

    // Update progress (streak/daily goal)
    await upsertProgress(user.id, language || 'Spanish', durationSeconds, newWords?.length || 0);

    // Add new words to dictionary
    if (newWords?.length > 0) {
      for (const word of newWords) {
        await addDictionaryEntry({
          userId: user.id,
          language: language || 'Spanish',
          term: word.term,
          meaning: word.meaning,
          example: word.example,
          scenario,
        });
      }
    }

    return NextResponse.json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error('Session save error:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    );
  }
}
