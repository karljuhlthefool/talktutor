'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, ChevronRight, LogOut, User, Bell, Globe } from 'lucide-react';
import { createClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { LANGUAGES, LEVELS, UserPreferences } from '@/lib/types';
import { getUserPreferences, upsertUserPreferences } from '@/lib/db-operations';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);

  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showDialectSelect, setShowDialectSelect] = useState(false);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const prefs = await getUserPreferences(user.id);
          if (prefs) {
            setPreferences(prefs);
          } else {
            // Default preferences for new users
            setPreferences({
              id: '',
              userId: user.id,
              language: 'Spanish',
              level: 'intermediate',
              dialect: '',
              dailyGoalMinutes: 10,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch preferences:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPreferences();
  }, []);

  const handleUpdatePreferences = async (updates: Partial<UserPreferences>) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const updated = await upsertUserPreferences(user.id, updates);
        setPreferences(updated);
      }
    } catch (err) {
      console.error('Failed to update preferences:', err);
      // Still update local state optimistically
      setPreferences(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-[#0c0c0e] px-4 py-6">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#0c0c0e] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Language */}
        <button
          onClick={() => setShowLanguageSelect(true)}
          className="w-full bg-white/5 hover:bg-white/10 rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-white/60" />
            <div className="text-left">
              <p className="text-sm text-white/60">Language</p>
              <p className="font-medium">{preferences?.language || 'Spanish'}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/40" />
        </button>

        {/* Level */}
        <button
          onClick={() => setShowLevelSelect(true)}
          className="w-full bg-white/5 hover:bg-white/10 rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-white/60" />
            <div className="text-left">
              <p className="text-sm text-white/60">Level</p>
              <p className="font-medium capitalize">{preferences?.level || 'intermediate'}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/40" />
        </button>

        {/* Daily Goal */}
        <div className="w-full bg-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-white/60" />
              <p className="text-sm text-white/60">Daily Goal</p>
            </div>
            <span className="font-medium">{preferences?.dailyGoalMinutes || 10} min</span>
          </div>
          <input
            type="range"
            min="5"
            max="30"
            value={preferences?.dailyGoalMinutes || 10}
            onChange={(e) => handleUpdatePreferences({ dailyGoalMinutes: parseInt(e.target.value) })}
            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
          />
        </div>

        {/* Account */}
        <div className="pt-6 border-t border-white/10">
          <h2 className="text-sm font-medium text-white/40 mb-4">Account</h2>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </Button>
        </div>

        {/* About */}
        <div className="pt-6 border-t border-white/10">
          <h2 className="text-sm font-medium text-white/40 mb-4">About</h2>
          <p className="text-sm text-white/40">
            TalkTutor helps you learn languages through voice-first conversation practice with AI.
          </p>
        </div>
      </div>

      {/* Language Select Modal */}
      {showLanguageSelect && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#1a1a1c] rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Select Language</h3>
              <button
                onClick={() => setShowLanguageSelect(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    handleUpdatePreferences({ language: lang.name });
                    setShowLanguageSelect(false);
                  }}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    preferences?.language === lang.name
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <p className="font-medium">{lang.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Level Select Modal */}
      {showLevelSelect && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#1a1a1c] rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Select Level</h3>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {LEVELS.map((level) => (
                <button
                  key={level.code}
                  onClick={() => {
                    handleUpdatePreferences({ level: level.code as any });
                    setShowLevelSelect(false);
                  }}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    preferences?.level === level.code
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <p className="font-medium">{level.name}</p>
                  <p className="text-sm text-white/60">{level.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
