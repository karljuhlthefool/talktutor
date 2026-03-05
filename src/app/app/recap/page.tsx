'use client';

import { useRouter } from 'next/navigation';
import { Flame, Clock, ArrowRight } from 'lucide-react';
import { SCENARIOS, type DictionaryEntry } from '@/lib/types';

interface RecapPageProps {
  durationSeconds: number;
  newWords: Partial<DictionaryEntry>[];
  scenario?: string;
  todayMinutes: number;
  dailyGoal: number;
  streak: number;
}

export default function RecapPage({
  durationSeconds,
  newWords,
  scenario,
  todayMinutes,
  dailyGoal,
  streak,
}: RecapPageProps) {
  const router = useRouter();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(100, (todayMinutes / dailyGoal) * 100);

  return (
    <div className="min-h-screen bg-[#0c0c0e] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Great session!</h1>
        <button
          onClick={() => router.push('/app')}
          className="text-white/60 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Session Summary Card */}
      <div className="bg-white/5 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-lg font-medium">Session Time</span>
          </div>
          <span className="text-2xl font-bold">{formatDuration(durationSeconds)}</span>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Daily Goal</span>
            <span className="text-sm font-medium">{todayMinutes} / {dailyGoal} min</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-2 text-orange-400">
            <Flame className="w-5 h-5" />
            <span className="font-medium">{streak} day streak!</span>
          </div>
        )}
      </div>

      {/* New Words Card */}
      {newWords.length > 0 && (
        <div className="bg-white/5 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">New Words</h2>
          <div className="space-y-3">
            {newWords.slice(0, 8).map((word, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="font-medium">{word.term}</p>
                  {word.meaning && (
                    <p className="text-sm text-white/60">{word.meaning}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {newWords.length > 8 && (
            <button
              onClick={() => router.push('/app/dictionary')}
              className="w-full mt-4 py-3 text-center text-blue-400 hover:text-blue-300"
            >
              View all in Dictionary →
            </button>
          )}
        </div>
      )}

      {/* Scenario Info */}
      {scenario && (
        <div className="bg-white/5 rounded-2xl p-4 mb-6">
          <p className="text-sm text-white/60">
            Scenario: <span className="text-white font-medium">{scenario}</span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => router.push('/app')}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 font-medium text-lg"
        >
          Start Another Call
        </button>
        <button
          onClick={() => router.push('/app/dictionary')}
          className="w-full py-4 rounded-2xl bg-white/5 text-white/80 font-medium"
        >
          View Dictionary
        </button>
        <button
          onClick={() => router.push('/app/progress')}
          className="w-full py-4 rounded-2xl bg-white/5 text-white/80 font-medium"
        >
          See Progress
        </button>
      </div>
    </div>
  );
}
