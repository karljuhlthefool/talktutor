'use client';

import { useState, useEffect } from 'react';
import { Flame, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/auth-client';
import { getWeeklyProgress, getStreakInfo, getUserPreferences } from '@/lib/db-operations';
import { DailyProgress, StreakInfo } from '@/lib/types';

// Fallback mock data for unauthenticated users
const mockWeeklyData: DailyProgress[] = [
  { id: '1', userId: 'demo', language: 'Spanish', date: '2026-03-04', secondsSpoken: 420, newWordsCount: 8, createdAt: new Date() },
  { id: '2', userId: 'demo', language: 'Spanish', date: '2026-03-03', secondsSpoken: 300, newWordsCount: 5, createdAt: new Date() },
  { id: '3', userId: 'demo', language: 'Spanish', date: '2026-03-02', secondsSpoken: 600, newWordsCount: 12, createdAt: new Date() },
];

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<DailyProgress[]>([]);
  const [streakInfo, setStreakInfo] = useState<StreakInfo>({ current: 0, best: 0 });
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(10);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const language = 'Spanish'; // TODO: Get from user preferences

        if (user) {
          const [weekly, streak, prefs] = await Promise.all([
            getWeeklyProgress(user.id, language),
            getStreakInfo(user.id, language),
            getUserPreferences(user.id),
          ]);
          setWeeklyData(weekly.length > 0 ? weekly : mockWeeklyData);
          setStreakInfo(streak);
          if (prefs?.dailyGoalMinutes) setDailyGoalMinutes(prefs.dailyGoalMinutes);
        } else {
          setWeeklyData(mockWeeklyData);
          setStreakInfo({ current: 3, best: 7 });
        }
      } catch (err) {
        console.error('Failed to fetch progress:', err);
        setWeeklyData(mockWeeklyData);
        setStreakInfo({ current: 0, best: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Calculate totals
  const todayData = weeklyData.find(
    (d) => d.date === new Date().toISOString().split('T')[0]
  );
  const todayMinutes = todayData ? todayData.secondsSpoken / 60 : 0;

  const weekTotalMinutes = weeklyData.reduce(
    (sum, d) => sum + d.secondsSpoken,
    0
  ) / 60;

  const weekTotalWords = weeklyData.reduce(
    (sum, d) => sum + d.newWordsCount,
    0
  )

  const progressPercent = Math.min(100, (todayMinutes / dailyGoalMinutes) * 100)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maxMinutes = Math.max(...weeklyData.map(d => d.secondsSpoken / 60), 15)

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#0c0c0e] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Progress</h1>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today's Progress */}
          <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-400" />
                <span className="font-medium">Today</span>
              </div>
              {streakInfo.current > 0 && (
                <div className="flex items-center gap-1 text-orange-400">
                  <Flame className="w-5 h-5" />
                  <span className="font-medium">{streakInfo.current}</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">Daily Goal</span>
                <span className="text-sm font-medium">{todayMinutes} / {dailyGoalMinutes} min</span>
              </div>
              <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {todayMinutes >= dailyGoalMinutes && (
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Goal reached! 🎉</span>
              </div>
            )}
          </div>

          {/* Weekly Chart */}
          <div className="bg-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">This Week</h2>
              <span className="text-sm text-white/60">{weekTotalMinutes} min total</span>
            </div>

            {/* Bar Chart */}
            <div className="flex items-end justify-between gap-2 h-32">
              {weeklyData.map((day, i) => {
                const minutes = day.secondsSpoken / 60
                const height = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 5
                const dayIndex = new Date(day.date).getDay()
                const dayName = dayNames[dayIndex]
                const isToday = day.date === new Date().toISOString().split('T')[0]

                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-xs text-white/40">{dayName}</span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        isToday ? 'bg-gradient-to-t from-blue-500 to-purple-500' : 'bg-white/20'
                      } ${height}%`}
                    />
                    <span className="text-xs font-medium">{minutes}</span>
                  </div>
                );
              })}
            </div>

            {/* Weekly Stats */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-sm text-white/60">Words Learned</p>
                <p className="text-2xl font-bold">{weekTotalWords}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-sm text-white/60">Best Streak</p>
                <p className="text-2xl font-bold">{streakInfo.best} days</p>
              </div>
            </div>
          </div>

          {/* Achievements / Badges (MVP-light) */}
          <div className="bg-white/5 rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Achievements</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">🎯</div>
                <p className="text-xs font-medium">First Call</p>
                <p className="text-xs text-white/40">Complete</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">🔥</div>
                <p className="text-xs font-medium">3-Day Streak</p>
                <p className="text-xs text-white/40">Keep it up!</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">📚</div>
                <p className="text-xs font-medium">50 Words</p>
                <p className="text-xs text-white/40">Keep learning</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
