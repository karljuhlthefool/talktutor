'use client';

import { useState, useEffect } from 'react';
import { Flame, TrendingUp, Calendar } from 'lucide-react';
import { createClient } from '@/lib/auth-client';
import { getWeeklyProgress, getStreakInfo, getUserPreferences } from '@/lib/db-operations';
import { DailyProgress, StreakInfo } from '@/lib/types';

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
        const language = 'Spanish';

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

  const todayData = weeklyData.find(
    (d) => d.date === new Date().toISOString().split('T')[0]
  );
  const todayMinutes = todayData ? Math.round(todayData.secondsSpoken / 60) : 0;
  const weekTotalMinutes = Math.round(weeklyData.reduce((sum, d) => sum + d.secondsSpoken, 0) / 60);
  const weekTotalWords = weeklyData.reduce((sum, d) => sum + d.newWordsCount, 0);
  const progressPercent = Math.min(100, (todayMinutes / dailyGoalMinutes) * 100);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxMinutes = Math.max(...weeklyData.map(d => d.secondsSpoken / 60), 15);

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-background px-5 py-6 md:py-8 md:max-w-2xl md:mx-auto">
      <h1 className="text-xl font-semibold tracking-tight mb-6">Progress</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Today's Progress */}
          <div className="bg-accent rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-[13px] font-medium text-muted-foreground">Today</span>
              </div>
              {streakInfo.current > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <Flame className="w-4 h-4" />
                  <span className="text-[13px] font-semibold tabular-nums">{streakInfo.current} day streak</span>
                </div>
              )}
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-muted-foreground">Daily Goal</span>
                <span className="text-[13px] font-medium tabular-nums">{todayMinutes} / {dailyGoalMinutes} min</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {todayMinutes >= dailyGoalMinutes && (
              <div className="flex items-center gap-1.5 text-success">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[13px] font-medium">Goal reached</span>
              </div>
            )}
          </div>

          {/* Weekly Chart */}
          <div className="bg-accent rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[15px] font-medium">This Week</p>
              <span className="text-[13px] text-muted-foreground tabular-nums">{weekTotalMinutes} min</span>
            </div>

            <div className="flex items-end justify-between gap-1.5 h-24 mb-2">
              {weeklyData.map((day, i) => {
                const minutes = Math.round(day.secondsSpoken / 60);
                const height = maxMinutes > 0 ? Math.max((minutes / maxMinutes) * 100, 4) : 4;
                const dayIndex = new Date(day.date).getDay();
                const isToday = day.date === new Date().toISOString().split('T')[0];

                return (
                  <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                    <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
                      <div
                        className={`w-full max-w-[28px] rounded transition-all ${
                          isToday ? 'bg-primary' : 'bg-border'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{dayNames[dayIndex]}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-[11px] text-muted-foreground mb-0.5">Words Learned</p>
                <p className="text-lg font-semibold tabular-nums">{weekTotalWords}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-[11px] text-muted-foreground mb-0.5">Best Streak</p>
                <p className="text-lg font-semibold tabular-nums">{streakInfo.best} days</p>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="bg-accent rounded-xl p-5">
            <p className="text-[15px] font-medium mb-4">Achievements</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: '1', label: 'First Call', status: 'Complete' },
                { icon: '3', label: '3-Day Streak', status: 'Keep it up' },
                { icon: '50', label: '50 Words', status: 'Keep learning' },
              ].map((badge) => (
                <div key={badge.label} className="bg-secondary/50 rounded-lg p-3 text-center">
                  <div className="w-8 h-8 mx-auto mb-1.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[13px] font-semibold">
                    {badge.icon}
                  </div>
                  <p className="text-[11px] font-medium">{badge.label}</p>
                  <p className="text-[10px] text-muted-foreground">{badge.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
