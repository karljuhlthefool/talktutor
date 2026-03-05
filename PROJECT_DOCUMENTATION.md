# TalkTutor - Language Learning App

A Next.js 16 language learning application with real-time voice practice powered by Google Gemini Live API.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [App Routes](#app-routes)
5. [Components](#components)
6. [Libraries & Utilities](#libraries--utilities)
7. [External Services](#external-services)
8. [Authentication Flow](#authentication-flow)
9. [Data Flow & State Management](#data-flow--state-management)
10. [API Routes](#api-routes)
11. [Styling Approach](#styling-approach)
12. [Configuration](#configuration)
13. [Database Schema](#database-schema)
14. [Voice Integration (Gemini Live)](#voice-integration-gemini-live)

---

## Overview

**TalkTutor** is a language learning app that helps users practice conversations through:

1. **Real-time voice calls** - Practice speaking with an AI tutor using the Gemini Live API
2. **Text-based chat** - Type conversations with corrections and feedback
3. **Progress tracking** - Monitor daily practice time, streaks, and vocabulary
4. **Dictionary** - Save and review words learned during sessions

The app supports 8 languages with multiple dialects and offers 9 practice scenarios (cafe, restaurant, doctor, etc.).

---

## Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | Next.js | 16.1.6 |
| **UI** | React | 19.2.3 |
| **Styling** | Tailwind CSS | v4 |
| **Auth & Database** | Supabase | v2.98.0 |
| **Real-time Voice** | Google Gemini Live API | - |
| **Text Chat** | Vercel AI SDK + z.ai | v6.0.112 |
| **Package Manager** | pnpm | - |
| **E2E Testing** | Playwright | v1.58.2 |

### Key Dependencies

```json
{
  "@supabase/supabase-js": "2.98.0",
  "@supabase/ssr": "0.9.0",
  "@google/generative-ai": "0.24.1",
  "ai": "6.0.112",
  "@ai-sdk/openai": "3.0.39",
  "lucide-react": "0.577.0",
  "class-variance-authority": "0.7.1"
}
```

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Root → redirects to /app/chat
│   ├── layout.tsx                # Root layout (fonts)
│   ├── globals.css               # Tailwind + custom CSS
│   ├── login/                    # Login page (magic link)
│   ├── onboarding/               # 4-step preferences wizard
│   ├── auth/callback/            # OAuth callback handler
│   ├── api/                      # API routes
│   │   ├── chat/                 # Streaming chat endpoint
│   │   ├── voice/                # Voice session management
│   │   └── sessions/             # Session persistence
│   └── app/                      # Protected app routes
│       ├── layout.tsx            # Auth check + nav
│       ├── page.tsx              # Speak (main voice page)
│       ├── chat/                 # Text chat practice
│       ├── dictionary/           # Vocabulary list
│       ├── progress/             # Stats dashboard
│       ├── settings/             # User preferences
│       ├── recap/                # Post-session summary
│       └── scenarios/            # Practice scenario picker
├── components/
│   ├── chat.tsx                  # Text chat interface
│   ├── voice-call.tsx            # Voice call interface
│   ├── audio-visualizer.tsx      # Mic level visualization
│   ├── bottom-nav.tsx            # Mobile navigation
│   ├── sidebar.tsx               # Desktop navigation
│   ├── trial-expired-modal.tsx   # Trial → signup modal
│   └── ui/                       # shadcn/ui primitives
│       ├── button.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── card.tsx
│       └── scroll-area.tsx
├── lib/
│   ├── types.ts                  # TypeScript types & constants
│   ├── utils.ts                  # cn() utility
│   ├── auth.ts                   # Server-side auth
│   ├── auth-client.ts            # Browser auth client
│   ├── supabase-client.ts        # Lazy-loaded Supabase
│   ├── db-operations.ts          # Database CRUD functions
│   ├── trial.ts                  # Trial gating (90s free)
│   ├── use-gemini-live.ts        # Gemini Live hook
│   └── voice-orchestrator.ts     # (older, unused)
└── middleware.ts                 # Route protection
```

---

## App Routes

### Public Routes

| Route | Purpose |
|-------|---------|
| `/` | Root → redirects to `/app/chat` |
| `/login` | Magic link (OTP) authentication |
| `/onboarding` | 4-step preferences wizard (language, level, dialect, goal) |
| `/auth/callback` | OAuth code exchange for session |

### Protected Routes (`/app/*`)

| Route | Purpose |
|-------|---------|
| `/app` | **Speak page** - Main voice practice with progress display |
| `/app/chat` | **Chat page** - Text-based AI tutor conversation |
| `/app/dictionary` | **Dictionary** - Saved vocabulary with search/detail views |
| `/app/progress` | **Progress** - Weekly chart, streaks, achievements |
| `/app/settings` | **Settings** - Language, level, daily goal, sign out |
| `/app/recap` | **Recap** - Post-session summary (words learned, time) |
| `/app/scenarios` | **Scenarios** - Practice scenario selection (9 options) |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Streaming AI chat (z.ai) |
| `/api/voice` | POST/GET | Voice session start/end/status |
| `/api/sessions` | POST | Persist session data to Supabase |

---

## Components

### Main Application Components

#### `Chat.tsx` - Text Chat Interface

**Purpose:** Text-based AI conversation with streaming responses.

**Key Features:**
- Uses `useChat` hook from Vercel AI SDK
- Calls `/api/chat` endpoint
- Suggestion chips for quick starts
- Markdown rendering (bold, italic, code)
- Auto-scroll to latest message
- Dynamic textarea resizing

**State:**
- `input: string` - Current message
- `messages: UIMessage[]` - Chat history
- `status` - Streaming status

---

#### `VoiceCall.tsx` - Real-time Voice Practice

**Purpose:** Full voice call interface with Gemini Live API.

**Props:**
```typescript
interface VoiceCallProps {
  onEnd: (data: {
    durationSeconds: number;
    transcript: TranscriptEntry[];
    corrections: Correction[];
    newWords: Array<{ term: string; meaning?: string }>;
    scenario?: string;
  }) => void;
}
```

**State:**
- `status: 'idle' | 'connecting' | 'active' | 'paused' | 'ended'`
- `duration: number` - Call seconds
- `transcript: TranscriptEntry[]` - Conversation log
- `scenario: string | null` - Selected practice context
- `corrections: Correction[]` - Grammar fixes
- `trialRemaining: number | null` - Trial time left

**Key Behaviors:**
- Requests mic permission
- Creates AudioContext for capture/playback
- Uses `useGeminiLive` hook for WebSocket connection
- POSTs to `/api/sessions` on call end
- Shows `TrialExpiredModal` when trial expires

---

#### `AudioVisualizer.tsx` - Mic Visualization

**Purpose:** Radial bar visualization of microphone audio.

**Props:**
```typescript
interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}
```

**Implementation:**
- 32 bars arranged radially
- Heights from 20px (silence) to 80px (max)
- Gradient from purple to blue
- Uses `requestAnimationFrame` for updates

---

#### `BottomNav.tsx` - Mobile Navigation

**Purpose:** Fixed bottom tab bar (hidden on desktop `md:hidden`).

**Navigation Items:**
| Path | Label | Icon |
|------|-------|------|
| `/app` | Speak | Mic |
| `/app/dictionary` | Dictionary | BookOpen |
| `/app/progress` | Progress | BarChart3 |
| `/app/settings` | Settings | Settings |

---

#### `Sidebar.tsx` - Desktop Navigation

**Purpose:** Fixed left sidebar (visible on desktop `md:flex`).

Same navigation items as BottomNav with:
- Logo/branding header
- Active indicator (left border)
- Footer with version info

---

#### `TrialExpiredModal.tsx` - Trial Conversion

**Purpose:** Full-screen modal when 90s trial expires.

**Behavior:**
- Email input for magic link signup
- Calls `supabase.auth.signInWithOtp()`
- Redirects to `/auth/callback`

---

### UI Primitives (shadcn/ui)

| Component | Purpose |
|-----------|---------|
| `Button` | CVA-based button with variants (default, outline, ghost, etc.) |
| `Input` | Styled input with focus ring |
| `Textarea` | Auto-sizing textarea |
| `Card` | Compound components (Card, CardHeader, CardTitle, etc.) |
| `ScrollArea` | Radix-based custom scrollbars |

---

## Libraries & Utilities

### `lib/types.ts` - Type Definitions

**Interfaces:**
```typescript
interface UserPreferences {
  language: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  dialect?: string;
  dailyGoalMinutes: number;
}

interface Session {
  id: string;
  language: string;
  scenario?: string;
  durationSeconds: number;
  transcript: TranscriptEntry[];
  createdAt: Date;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  correction?: Correction;
}

interface DictionaryEntry {
  id: string;
  term: string;
  meaning: string;
  example?: string;
  language: string;
  scenario?: string;
  learnedAt: Date;
}

interface DailyProgress {
  date: string;
  secondsSpoken: number;
  newWordsCount: number;
}

interface StreakInfo {
  current: number;
  best: number;
}
```

**Constants:**
- `LANGUAGES` - 8 languages with dialects (Spanish, French, German, Italian, Portuguese, Japanese, Korean, Mandarin)
- `LEVELS` - 3 proficiency levels
- `SCENARIOS` - 9 practice scenarios with icons

---

### `lib/db-operations.ts` - Database CRUD

**Server Actions (marked `'use server'`):**

| Function | Purpose |
|----------|---------|
| `createSession()` | Create voice session record |
| `getUserSessions()` | Fetch user's session history |
| `addDictionaryEntry()` | Add vocabulary word |
| `getDictionaryEntries()` | Fetch user's dictionary |
| `deleteDictionaryEntry()` | Remove word |
| `getTodayProgress()` | Today's stats for a language |
| `upsertProgress()` | Update daily progress |
| `getWeeklyProgress()` | Last 7 days of progress |
| `getStreakInfo()` | Calculate current/best streaks |
| `getUserPreferences()` | Fetch user settings |
| `upsertUserPreferences()` | Save user settings |

**Note:** All functions handle snake_case ↔ camelCase conversion between DB and TypeScript.

---

### `lib/auth.ts` - Server-Side Auth

**Exports:**
| Function | Purpose |
|----------|---------|
| `createClient()` | Server-side Supabase client with cookies |
| `getUser()` | Get current user (supports `BYPASS_AUTH`) |
| `updateSession()` | Middleware helper for route protection |

**BYPASS_AUTH Mode:**
- Enabled when `BYPASS_AUTH=true` AND `NODE_ENV=development`
- Returns mock test user (`test@local.dev`)
- Skips all Supabase auth checks

---

### `lib/trial.ts` - Trial Gating

**Purpose:** 90-second free trial for unauthenticated users.

| Function | Purpose |
|----------|---------|
| `getTrialState()` | Returns `{ isTrial, used, remaining, expired }` |
| `startTrial()` | Marks trial start in localStorage |
| `endTrial()` | Marks trial as used |

**Constants:**
- `TRIAL_LIMIT_SECONDS = 90`
- `TRIAL_STORAGE_KEY = 'talktutor_trial'`

---

### `lib/use-gemini-live.ts` - Gemini Live Hook

**Interface:**
```typescript
interface UseGeminiLiveOptions {
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  onError: (err: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

interface UseGeminiLiveReturn {
  connect: (stream: MediaStream, audioContext: AudioContext, systemPrompt: string) => void;
  disconnect: () => void;
  sendTextMessage: (text: string) => void;
}
```

**See [Voice Integration](#voice-integration-gemini-live) for full details.**

---

## External Services

### 1. Supabase (Auth + Database)

**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional)

**Tables:**
- `sessions` - Voice call logs with transcripts
- `dictionary_entries` - User vocabulary
- `user_progress` - Daily practice stats
- `user_preferences` - Language, level, goal settings

---

### 2. Google Gemini Live API (Real-time Voice)

**Environment Variables:**
- `NEXT_PUBLIC_GEMINI_API_KEY`

**WebSocket Endpoint:**
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
```

**Model:** `models/gemini-2.5-flash-native-audio-latest`

---

### 3. z.ai / OpenAI-Compatible API (Text Chat)

**Environment Variables:**
- `ZAI_API_KEY`
- `ZAI_BASE_URL` = `https://api.zukijourney.com/v1`

**Model:** `glm-4.6`

**Integration:** Via Vercel AI SDK's `streamText()` function.

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     User visits /app/*                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Middleware (updateSession)                     │
│                  Checks for valid session cookie                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────┐           ┌─────────────────────┐
│   No Session        │           │   Valid Session      │
│   → Redirect /login │           │   → Continue to page │
└─────────────────────┘           └─────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Login Page (/login)                          │
│                   User enters email                              │
│              signInWithOtp() sends magic link                    │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼ (email link clicked)
┌─────────────────────────────────────────────────────────────────┐
│                   Auth Callback (/auth/callback)                 │
│            Exchanges code for session via Supabase               │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Redirect to /app/chat                          │
│                  (or /onboarding for new users)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Onboarding Flow (4 Steps)

1. **Language Selection** - Choose from 8 languages
2. **Level Selection** - Beginner, Intermediate, or Advanced
3. **Dialect Preference** - Optional, varies by language
4. **Daily Goal** - 5, 10, 15, 20, or 30 minutes

**Note:** "Skip for now" is available on any step.

---

## Data Flow & State Management

### State Management Pattern

**No global context providers.** Each page:
1. Manages its own state with `useState`
2. Fetches data on mount with `useEffect`
3. Calls server actions directly for mutations

### Data Fetching Pattern

```typescript
// Typical page data fetch
useEffect(() => {
  async function fetchData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const data = await getSomeData(user.id);
      setState(data);
    }
  }
  fetchData();
}, []);
```

### Real-time Voice Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Microphone │ ──▶ │ AudioContext │ ──▶ │ ScriptProc  │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────┐
│                   useGeminiLive Hook                     │
│  • Downsample to 16kHz Int16 PCM                        │
│  • Convert to base64                                     │
│  • Send via WebSocket to Gemini                          │
└─────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────┐
│                  Gemini Live API                         │
│  • Processes audio                                       │
│  • Returns audio + transcriptions                        │
└─────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────┐
│                   useGeminiLive Hook                     │
│  • Decode base64 audio                                   │
│  • Schedule playback via AudioContext                    │
│  • Call onTranscript callback                            │
└─────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  VoiceCall  │ ──▶ │  Transcript  │ ──▶ │  Speakers   │
│  Component  │     │    State     │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
```

---

## API Routes

### `/api/chat` - Streaming Chat

**Method:** `POST`

**Request:**
```json
{
  "messages": UIMessage[]
}
```

**Response:** Streaming `UIMessageStreamResponse`

**Behavior:**
1. Authenticates user via `getUser()`
2. Creates z.ai client (OpenAI-compatible)
3. Streams response with language tutor system prompt
4. Returns streaming response for `useChat` hook

---

### `/api/voice` - Voice Session Management

**Method:** `POST` or `GET`

**POST Actions:**
```json
// Start session
{ "action": "start", "language": "Spanish", "level": "beginner", "scenario": "cafe" }

// End session
{ "action": "end", "sessionId": "uuid" }
```

**GET:** `?sessionId=uuid` → Returns session status

**Note:** Partially implemented with TODOs for full Supabase persistence.

---

### `/api/sessions` - Session Persistence

**Method:** `POST`

**Request:**
```json
{
  "language": "Spanish",
  "scenario": "cafe",
  "durationSeconds": 420,
  "transcript": TranscriptEntry[],
  "newWords": [{ "term": "hola", "meaning": "hello", "example": "..." }]
}
```

**Behavior:**
1. Creates session record in `sessions` table
2. Updates daily progress in `user_progress`
3. Adds new words to `dictionary_entries`

---

## Styling Approach

### Tech Stack
- **Tailwind CSS v4** with CSS-based configuration (no `tailwind.config.js`)
- **OKLCH color space** for perceptually uniform dark palette
- **class-variance-authority (CVA)** for component variants
- **cn() utility** for class merging

### Color Palette (Dark Theme)

```css
:root {
  --background: oklch(0.09 0.005 270);     /* Near-black purple tint */
  --foreground: oklch(0.95 0.002 270);     /* Off-white */
  --card: oklch(0.13 0.005 270);           /* Card background */
  --primary: oklch(0.65 0.16 250);         /* Blue-purple accent */
  --muted: oklch(0.15 0.005 270);          /* Muted background */
  --accent: oklch(0.18 0.005 270);         /* Accent background */
  --destructive: oklch(0.65 0.2 25);       /* Red errors */
  --success: oklch(0.72 0.17 165);         /* Green success */
  --warning: oklch(0.8 0.15 85);           /* Yellow warning */
}
```

### Typography
- **Primary:** Plus Jakarta Sans
- **Monospace:** Geist Mono

### Custom CSS Classes

| Class | Purpose |
|-------|---------|
| `.skeleton` | Loading shimmer |
| `.typing-dot` | Chat typing indicator |
| `.bubble`, `.bubble-user`, `.bubble-assistant` | Chat message bubbles |
| `.selection-card` | Selectable list items |
| `.progress-fill` | Animated progress bar |
| `.sheet-overlay`, `.sheet-content` | Bottom sheet animations |

### Responsive Design

- **Mobile-first** approach
- `md:` breakpoint at 768px for desktop styles
- Bottom nav hidden on desktop
- Sidebar hidden on mobile
- Bottom sheets become centered dialogs on desktop

---

## Configuration

### Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Admin operations (optional) |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Public | Gemini Live WebSocket |
| `ZAI_API_KEY` | Server | z.ai chat API |
| `ZAI_BASE_URL` | Server | z.ai base URL |
| `BYPASS_AUTH` | Server | Dev auth bypass |

### Package Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

### Supabase Local Development

Configured in `supabase/config.toml`:
- API Port: 54321
- DB Port: 54322 (Postgres 17)
- Studio Port: 54323
- Email Testing (Inbucket): 54324

---

## Database Schema

### `sessions`
```sql
id: uuid (primary key)
user_id: uuid (foreign key → auth.users)
language: text
scenario: text
duration_seconds: integer
transcript: jsonb
created_at: timestamp
```

### `dictionary_entries`
```sql
id: uuid (primary key)
user_id: uuid (foreign key → auth.users)
term: text
meaning: text
example: text
language: text
scenario: text
learned_at: timestamp
```

### `user_progress`
```sql
id: uuid (primary key)
user_id: uuid (foreign key → auth.users)
date: date
language: text
seconds_spoken: integer
new_words_count: integer
```

### `user_preferences`
```sql
id: uuid (primary key)
user_id: uuid (foreign key → auth.users)
language: text
level: text
dialect: text
daily_goal_minutes: integer
```

---

## Voice Integration (Gemini Live)

### WebSocket Protocol

**Endpoint:**
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}
```

**Model:** `models/gemini-2.5-flash-native-audio-latest`

### Message Formats

#### Setup (Client → Server)
```json
{
  "setup": {
    "model": "models/gemini-2.5-flash-native-audio-latest",
    "generation_config": {
      "response_modalities": ["AUDIO"],
      "speech_config": {
        "voice_config": {
          "prebuilt_voice_config": { "voice_name": "Puck" }
        }
      }
    },
    "system_instruction": {
      "parts": [{ "text": "<system prompt>" }]
    }
  }
}
```

#### Audio Input (Client → Server)
```json
{
  "realtime_input": {
    "media_chunks": [{
      "mime_type": "audio/pcm;rate=16000",
      "data": "<base64-encoded-int16-pcm>"
    }]
  }
}
```

#### Server Response (Server → Client)
```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [{
        "inlineData": {
          "mimeType": "audio/pcm;rate=24000",
          "data": "<base64-encoded-audio>"
        }
      }]
    },
    "outputTranscription": { "text": "AI response" },
    "inputTranscription": { "text": "User speech" }
  }
}
```

### Audio Pipeline

#### Input (Mic → Server)
1. `MediaStream` → `MediaStreamAudioSourceNode` → `ScriptProcessorNode`
2. Downsample native rate → 16kHz via linear interpolation
3. Float32 → Int16 PCM (× 32768, clamp)
4. Int16Array → Base64
5. Send via `realtime_input.media_chunks`

#### Output (Server → Speakers)
1. Receive base64 audio in `serverContent.modelTurn`
2. Base64 → Int16Array
3. Int16 → Float32 (÷ 32768)
4. Create `AudioBuffer` at 24kHz
5. Schedule via `scheduleAudioChunk()` with precise timing

### Key Implementation Notes

1. **Model name:** Must use `models/gemini-2.5-flash-native-audio-latest` (not `gemini-live-*`)
2. **Binary Blob handling:** API sends Blob frames, must `await event.data.text()` before `JSON.parse()`
3. **No `output_audio_transcription`:** This field in `generation_config` causes error 1007
4. **Audio rates:** Input 16kHz, Output 24kHz
5. **Voice:** Uses `Puck` prebuilt voice

---

## Component Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                         App Layout                               │
│     (Sidebar for desktop + page content + BottomNav)             │
└─────────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐       ┌─────────────────┐
│   Chat      │      │ VoiceCall   │       │ Dictionary/     │
│             │      │             │       │ Progress Pages  │
└─────────────┘      └─────────────┘       └─────────────────┘
       │                      │
       │                      ├────── AudioVisualizer
       │                      │
       │                      ├────── TrialExpiredModal
       │                      │
       ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      UI Primitives                               │
│   Button │ Input │ Textarea │ Card │ ScrollArea                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Known Issues / TODOs

1. **`/api/voice` route** - Has TODOs for full Supabase persistence (currently stubbed)
2. **Onboarding detection** - No automatic redirect for new users; users go directly to `/app/chat` after auth
3. **Recap page** - Expects props that aren't passed via URL (implementation bug)
4. **`voice-orchestrator.ts`** - Older implementation, appears unused (replaced by `use-gemini-live.ts`)

---

*Documentation generated March 5, 2026*
