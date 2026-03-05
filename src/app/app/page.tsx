'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Flame, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SCENARIOS } from '@/lib/types';
import { VoiceCall } from '@/components/voice-call';
import { createClient } from '@/lib/auth-client';
import { getTodayProgress, getStreakInfo, getUserPreferences } from '@/lib/db-operations';

const DEFAULT_LANGUAGE = 'Spanish';
const DEFAULT_GOAL_MINUTES = 10;

export default function SpeakPage() {
  const router = useRouter();
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [inCall, setInCall] = useState(false);
  const [callScenario, setCallScenario] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL_MINUTES);
  const [streak, setStreak] = useState(0);

  const progressPercent = Math.min(100, (todayMinutes / dailyGoal) * 100);

  // Fetch progress on mount
  useEffect(() => {
    async function fetchProgress() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const [progress, streakInfo, prefs] = await Promise.all([
            getTodayProgress(user.id, language),
            getStreakInfo(user.id, language),
            getUserPreferences(user.id),
          ]);

          if (progress) {
            setTodayMinutes(Math.floor(progress.secondsSpoken / 60));
          }
          if (streakInfo) {
            setStreak(streakInfo.current);
          }
          if (prefs) {
            setDailyGoal(prefs.dailyGoalMinutes);
            if (prefs.language) setLanguage(prefs.language);
          }
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, [language]);

  const handleStartCall = (scenario?: string | null) => {
    setCallScenario(scenario || null);
    setInCall(true);
  };

  const handleCallEnd = (data: {
    durationSeconds: number;
    transcript: Array<{ role: string; content: string; timestamp: string; correction?: any }>;
    corrections: any[];
    newWords: Array<{ term: string; meaning?: string }>;
    scenario?: string;
  }) => {
    setInCall(false);

    // Update local state with new progress
    const newMinutes = Math.floor(data.durationSeconds / 60);
    setTodayMinutes(prev => prev + newMinutes);

    // Navigate to recap with session data
    const params = new URLSearchParams({
      duration: data.durationSeconds.toString(),
      words: data.newWords.length.toString(),
      scenario: data.scenario || callScenario || '',
    });

    router.push(`/app/recap?${params.toString()}`);
  };

  if (inCall) {
    return <VoiceCall onEnd={handleCallEnd} />;
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col px-4 py-6">
      {/* Language Switcher */}
      <div className="flex justify-center mb-8">
        <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-lg font-medium">{language}</span>
          <ChevronDown className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Today's Progress Card */}
      <div className="bg-white/5 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Today</h2>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 text-orange-400">
              <Flame className="w-5 h-5" />
              <span className="font-medium">{streak}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <p className="text-sm text-white/60 text-center">
          {todayMinutes} / {dailyGoal} min today
        </p>
      </div>

      {/* Start Call Button */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <button
          onClick={() => handleStartCall(callScenario)}
          className={cn(
            'w-32 h-32 rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-blue-500 to-purple-600',
            'shadow-lg shadow-purple-500/30',
            'hover:scale-105 active:scale-95 transition-transform',
            'focus:outline-none focus:ring-4 focus:ring-purple-500/50'
          )}
        >
          <Mic className="w-14 h-14 text-white" />
        </button>
        <p className="text-lg font-medium">Start Call</p>
      </div>

      {/* Scenario Picker Link */}
      <div className="mt-auto">
        <button
          onClick={() => router.push('/app/scenarios')}
          className="w-full py-3 text-center text-white/60 hover:text-white/80 transition-colors"
        >
          Pick a scenario →
        </button>
      </div>
    </div>
  );
}
