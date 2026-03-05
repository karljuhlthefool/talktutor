# TalkTutor MVP: Gap Analysis & Implementation Plan

**Generated:** March 4, 2026
**Project:** /Users/karl/work/language-app

---

## Executive Summary

The current app is a **text-based language chat** with Supabase auth. The spec requires a **voice-first live call** experience with progress tracking, dictionary, and gamification. This is a **significant pivot** from the current implementation.

---

## Current State vs Spec

| Feature | Spec | Current State | Gap |
|---------|------|---------------|-----|
| **Core Interaction** | Voice-first live call | Text-based chat | 🔴 MAJOR |
| **Language Selection** | Language, level, dialect, daily goal | None | 🔴 MISSING |
| **Bottom Nav** | Speak, Dictionary, Progress, Settings | None (single chat page) | 🔴 MISSING |
| **Voice Call UI** | Waveform, timer, action chips, transcript drawer | N/A (no voice) | 🔴 MISSING |
| **Scenario Picker** | 6-10 scenarios + "Surprise me" | None | 🔴 MISSING |
| **Post-Session Recap** | Duration, goal progress, streak, new words | None | 🔴 MISSING |
| **Dictionary Tab** | Words learned with examples | None | 🔴 MISSING |
| **Progress Tab** | Minutes, daily goal bar, weekly chart, streak | None | 🔴 MISSING |
| **Trial Gating** | 1-2 min free → magic link prompt | Auth-only, no limits | 🔴 MISSING |
| **Gamification** | Daily goal, streak, new words count | None | 🔴 MISSING |
| **Auth** | Magic link | ✅ Magic link (Supabase) | 🟢 DONE |
| **AI Integration** | Real-time voice with corrections | Text chat with inline corrections | 🟡 PARTIAL |
| **Database** | Sessions, progress, dictionary | None (auth only) | 🔴 MISSING |

---

## Implementation Phases

### Phase 1: Foundation (Data Models + Navigation)

**Goal:** Set up the database schema and app structure to support all features.

#### 1.1 Supabase Database Schema

```sql
-- User preferences (language, level, dialect, daily goal)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL DEFAULT 'Spanish',
  level TEXT NOT NULL DEFAULT 'intermediate',
  dialect TEXT DEFAULT 'Spain (Barcelona)',
  daily_goal_minutes INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Sessions (call logs)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  scenario TEXT,
  transcript JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dictionary entries
CREATE TABLE dictionary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL,
  term TEXT NOT NULL,
  meaning TEXT,
  example TEXT,
  scenario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User progress (per language)
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  language TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  seconds_spoken INT DEFAULT 0,
  new_words_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, language, date)
);

-- Indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_dictionary_user ON dictionary_entries(user_id);
CREATE INDEX idx_progress_user_date ON user_progress(user_id, date);
```

#### 1.2 TypeScript Types

```typescript
// src/lib/types.ts

export interface UserPreferences {
  language: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  dialect: string;
  dailyGoalMinutes: number;
}

export interface Session {
  id: string;
  language: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  scenario?: string;
  transcript?: TranscriptEntry[];
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  correction?: Correction;
}

export interface Correction {
  original: string;
  corrected: string;
}

export interface DictionaryEntry {
  id: string;
  term: string;
  meaning: string;
  example?: string;
  scenario?: string;
  createdAt: Date;
}

export interface DailyProgress {
  date: string;
  secondsSpoken: number;
  newWordsCount: number;
}

export interface StreakInfo {
  current: number;
  best: number;
}
```

#### 1.3 App Structure Reorganization

```
src/app/
├── (app)/                    # Protected routes group
│   ├── layout.tsx            # Bottom nav layout
│   ├── page.tsx              # Speak tab (home)
│   ├── dictionary/
│   │   └── page.tsx          # Dictionary tab
│   ├── progress/
│   │   └── page.tsx          # Progress tab
│   └── settings/
│       └── page.tsx          # Settings tab
├── login/
│   └── page.tsx              # Magic link login
├── onboarding/
│   └── page.tsx              # First-time setup
├── api/
│   ├── chat/route.ts         # (existing)
│   ├── voice/                # Voice session API
│   └── progress/             # Progress tracking API
└── auth/
    └── callback/route.ts     # (existing)
```

---

### Phase 2: Voice Integration (The Core Feature)

**Goal:** Implement real-time voice calling with AI.

#### 2.1 Technology Options

| Approach | Pros | Cons |
|----------|------|------|
| **WebRTC + WebSocket** | Real-time, low latency | Complex, needs signaling server |
| **OpenAI Realtime API** | Built for voice, native | Requires OpenAI, not z.ai compatible |
| **Whisper + TTS Pipeline** | Uses existing z.ai | Higher latency, more complex |
| **Vapi / Retell AI** | Ready-made voice AI | Third-party dependency, cost |

**Recommendation:** Start with **Vapi** or **Retell AI** for fastest MVP, or implement **Whisper + TTS pipeline** if staying with z.ai is critical.

#### 2.2 Voice Session Flow

```
1. User taps "Start Call"
2. Request mic permission
3. Connect to voice AI service
4. AI proposes 3 scenarios (voice + UI chips)
5. User selects (voice or tap)
6. Roleplay begins
7. Real-time transcript appears (optional drawer)
8. Corrections shown as toasts
9. User taps "End Call" (or trial limit)
10. Post-session recap shown
11. Words extracted to dictionary
```

#### 2.3 Components Needed

- `VoiceCall.tsx` - Main call screen with waveform, timer, end button
- `WaveformVisualizer.tsx` - Audio visualization
- `TranscriptDrawer.tsx` - Collapsible transcript
- `CorrectionToast.tsx` - In-call correction notifications
- `ScenarioPicker.tsx` - Scenario selection chips
- `VoiceOrchestrator.ts` - Manages voice session state

---

### Phase 3: Progress & Gamification

**Goal:** Make users feel progress and want to return.

#### 3.1 Components

- `DailyGoalProgress.tsx` - Progress bar (X/Y minutes today)
- `StreakBadge.tsx` - Fire emoji + count
- `WeeklyChart.tsx` - 7-day bar chart
- `SessionRecap.tsx` - Post-call summary screen
- `Badge.tsx` - Achievement badges

#### 3.2 Logic

- **Streak calculation:** Count consecutive days with ≥1 minute spoken
- **Daily goal:** Compare `seconds_spoken` to `daily_goal_minutes * 60`
- **New words:** Count dictionary entries from today's sessions

---

### Phase 4: Trial Gating

**Goal:** Let users try before committing to sign-in.

#### 4.1 Implementation

```typescript
// src/lib/trial.ts

const TRIAL_LIMIT_SECONDS = 90; // 1.5 minutes

export function getTrialState() {
  const trialUsed = localStorage.getItem('trialUsed');
  const trialStart = localStorage.getItem('trialStart');

  if (!trialStart) return { isTrial: false, used: !!trialUsed };

  const elapsed = (Date.now() - parseInt(trialStart)) / 1000;
  const remaining = Math.max(0, TRIAL_LIMIT_SECONDS - elapsed);

  return {
    isTrial: true,
    used: !!trialUsed,
    remaining,
    expired: remaining === 0
  };
}

export function startTrial() {
  localStorage.setItem('trialStart', Date.now().toString());
}

export function endTrial() {
  localStorage.setItem('trialUsed', 'true');
  localStorage.removeItem('trialStart');
}
```

#### 4.2 UX Flow

1. Anonymous user → trial mode
2. In-call shows "Trial: X:XX remaining"
3. On expiry → modal: "Continue with magic link"
4. After login → progress restored (if we save locally during trial)

---

### Phase 5: Onboarding & Settings

**Goal:** Get users into their first call in <20 seconds.

#### 5.1 Onboarding Screen

Single page with:
- Language dropdown (default: Spanish)
- Level (Beginner/Intermediate/Advanced)
- Dialect (optional)
- Daily goal (default: 10 min)
- CTA: "Start speaking"

#### 5.2 Settings Tab

- Language defaults
- Daily goal adjustment
- Account (sign out)
- Data/privacy

---

## Recommended Build Order

### Sprint 1 (Foundation)
1. ✅ Set up Supabase tables
2. ✅ Create TypeScript types
3. ✅ Restructure routes with bottom nav layout
4. ✅ Build onboarding page
5. ✅ Implement settings page (basic)

### Sprint 2 (Voice Core)
1. ✅ Choose voice integration approach
2. ✅ Implement voice call UI (waveform, timer, controls)
3. ✅ Build scenario picker
4. ✅ Connect to AI voice service
5. ✅ Basic transcript display

### Sprint 3 (Progress & Recap)
1. ✅ Post-session recap screen
2. ✅ Daily goal progress component
3. ✅ Streak tracking
4. ✅ Dictionary tab (basic list + detail)
5. ✅ Progress tab (today + week view)

### Sprint 4 (Polish & Launch)
1. ✅ Trial gating implementation
2. ✅ Correction toasts during calls
3. ✅ Word extraction to dictionary
4. ✅ Badges (first session, 10 min day, 3-day streak)
5. ✅ Mobile polish & animations

---

## Technical Decisions Needed

### 1. Voice Provider
- [x] **Google Live API (Gemini 2.0 Flash Live)** ✅ SELECTED
  - Real-time bidirectional voice via WebSocket
  - Native interruption support
  - Good multilingual support
  - Need: Google AI SDK or direct WebSocket implementation
- [ ] ~~Vapi.ai~~
- [ ] ~~Retell AI~~
- [ ] ~~Custom Whisper + TTS~~
- [ ] ~~OpenAI Realtime API~~

### 2. State Management
- [ ] Continue with React state + useChat
- [ ] Add Zustand for global state (progress, dictionary)
- [ ] Use React Context for user preferences

### 3. Data Persistence
- [ ] All in Supabase (recommended for MVP)
- [ ] Hybrid: local-first with Supabase sync
- [ ] Local only (simpler, no cross-device)

---

## Summary

The current app is **~10% aligned** with the spec. The biggest gap is **voice** - the entire product concept hinges on real-time voice calls, which don't exist yet. The recommended approach is:

1. **Sprint 1:** Database + navigation structure (enables all other work)
2. **Sprint 2:** Voice integration (the core differentiator)
3. **Sprint 3:** Progress/recap/dictionary (the motivational loop)
4. **Sprint 4:** Trial gating + polish (ready for users)

**Estimated effort:** 3-4 weeks for a focused MVP, depending on voice provider choice.
