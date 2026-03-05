# TalkTutor MVP Progress

## Status: Feature-Complete (AI Integration Deferred)

---

## Done ✅

**Infrastructure**
- Next.js 16, React 19, Tailwind 4
- Supabase auth (magic link OTP)
- Auth bypass for local dev (`BYPASS_AUTH=true`)
- AI SDK with z.ai GLM-4.6
- Build passes clean

**Database**
- Schema designed & migrated (`supabase/migrations/001_initial_schema.sql`)
- Tables: `user_preferences`, `sessions`, `dictionary_entries`, `user_progress`
- RLS policies for user data isolation
- Supabase CLI initialized

**Types/Libs**
- `types.ts` - TypeScript interfaces
- `trial.ts` - Trial gating (90 sec limit)
- `supabase-client.ts` - Supabase client
- `db-operations.ts` - CRUD operations with snake_case mappings

**Pages (8 total)**
- `/app` - Speak tab (fetches real progress)
- `/app/dictionary` - Word list (fetches/deletes from Supabase)
- `/app/progress` - Stats (streak, weekly chart from Supabase)
- `/app/settings` - Preferences (saves to Supabase)
- `/app/scenarios` - Scenario picker
- `/app/recap` - Post-session summary
- `/onboarding` - 4-step setup (saves to Supabase)
- Layout with bottom nav

**Components**
- Voice call UI with transcript drawer
- Audio visualizer (radial bars from analyser)
- Trial expired modal
- Bottom navigation

**APIs**
- `/api/sessions` - Save sessions, upsert progress, add dictionary entries
- `/api/voice` - Stub (not currently used)

**P1: Voice Experience**
- ✅ Transcript display during call
- ✅ Word extraction to dictionary (via sessions API)
- ✅ Session persistence to Supabase

**P2: Progress & Gamification**
- ✅ Streak calculation (consecutive days)
- ✅ Daily goal % tracking
- ✅ Weekly chart with real data

**P3: Polish**
- ✅ Audio waveform visualization
- ✅ Error states (mic denied, connection lost)
- ✅ Mobile animations (connecting rings, scenario picker slide-up)

---

## Deferred (Manual)

**Google Live API Integration**
- Real-time voice conversation
- AI-generated corrections
- Live transcript from speech
- Action chips (Translate last, Slow down, Repeat)

---

## Known Limitations

- Transcript is simulated until Google Live API wired
- Corrections are placeholder (no real AI feedback)
- Action chips in voice call are stubs

---

## Verified Working

| Feature | Source |
|---------|--------|
| Dictionary CRUD | Supabase |
| Progress/streak data | Supabase |
| Settings persistence | Supabase |
| Onboarding save | Supabase |
| Session save on call end | Supabase |
| Trial gating | localStorage |
| Audio visualizer | Web Audio API |
| Error handling | UI feedback |
