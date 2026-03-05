import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';

export const maxDuration = 60;

// POST /api/voice - Start or end a voice session
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, language, level, dailyGoalMinutes, scenario, sessionId } = body;

  // Start a new session
  if (action === 'start') {
    if (!language || !level) {
      return NextResponse.json({ error: 'Language and level required' }, { status: 400 });
    }

    const newSessionId = crypto.randomUUID();
    const startTime = new Date();

    // TODO: Store in Supabase
    return NextResponse.json({
      sessionId: newSessionId,
      language,
      level,
      dailyGoalMinutes,
      scenario,
      status: 'active',
      startedAt: startTime.toISOString(),
      durationSeconds: 0
    });
  }

  // End an existing session
  if (action === 'end') {
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    // TODO: Fetch and update session in Supabase
    const durationSeconds = 420;

    return NextResponse.json({
      sessionId,
      durationSeconds,
      endedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// GET /api/voice - Get session status (requires sessionId query param)
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // TODO: Fetch from Supabase
  // For now, return mock data
  return NextResponse.json({
    sessionId,
    status: 'active',
    durationSeconds: 120,
  });
}
