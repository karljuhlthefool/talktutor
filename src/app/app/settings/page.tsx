'use client';

import { useState, useEffect } from 'react';
import { Settings, ChevronRight, LogOut, Globe, BarChart3, Check, X } from 'lucide-react';
import { createClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { LANGUAGES, LEVELS, UserPreferences } from '@/lib/types';
import { getUserPreferences, upsertUserPreferences } from '@/lib/db-operations';
import { useRouter } from 'next/navigation';

function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 sheet-overlay" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl sheet-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-8 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);

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
      <div className="min-h-[calc(100dvh-5rem)] bg-background px-5 py-6 md:py-8 md:max-w-lg md:mx-auto">
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-background px-5 py-6 md:py-8 md:max-w-lg md:mx-auto">
      <h1 className="text-xl font-semibold tracking-tight mb-6">Settings</h1>

      <div className="space-y-1.5">
        {/* Language */}
        <button
          onClick={() => setShowLanguageSelect(true)}
          className="w-full bg-accent hover:bg-secondary rounded-xl p-4 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3">
            <Globe className="w-[18px] h-[18px] text-muted-foreground" />
            <div className="text-left">
              <p className="text-[13px] text-muted-foreground">Language</p>
              <p className="text-[15px] font-medium">{preferences?.language || 'Spanish'}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Level */}
        <button
          onClick={() => setShowLevelSelect(true)}
          className="w-full bg-accent hover:bg-secondary rounded-xl p-4 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-[18px] h-[18px] text-muted-foreground" />
            <div className="text-left">
              <p className="text-[13px] text-muted-foreground">Level</p>
              <p className="text-[15px] font-medium capitalize">{preferences?.level || 'intermediate'}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Daily Goal */}
        <div className="bg-accent rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Settings className="w-[18px] h-[18px] text-muted-foreground" />
              <p className="text-[13px] text-muted-foreground">Daily Goal</p>
            </div>
            <span className="text-[15px] font-medium tabular-nums">{preferences?.dailyGoalMinutes || 10} min</span>
          </div>
          <input
            type="range"
            min="5"
            max="30"
            step="5"
            value={preferences?.dailyGoalMinutes || 10}
            onChange={(e) => handleUpdatePreferences({ dailyGoalMinutes: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      {/* Account */}
      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-[13px] font-medium text-muted-foreground mb-3 px-1">Account</p>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
        >
          <LogOut className="w-4 h-4 mr-2.5" />
          Sign Out
        </Button>
      </div>

      {/* About */}
      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-[13px] text-muted-foreground px-1 leading-relaxed">
          TalkTutor helps you learn languages through conversation practice with AI.
        </p>
      </div>

      {/* Language Sheet */}
      <Sheet
        open={showLanguageSelect}
        onClose={() => setShowLanguageSelect(false)}
        title="Language"
      >
        <div className="space-y-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                handleUpdatePreferences({ language: lang.name });
                setShowLanguageSelect(false);
              }}
              data-selected={preferences?.language === lang.name}
              className="selection-card flex items-center justify-between"
            >
              <p className="font-medium text-[15px]">{lang.name}</p>
              {preferences?.language === lang.name && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Level Sheet */}
      <Sheet
        open={showLevelSelect}
        onClose={() => setShowLevelSelect(false)}
        title="Level"
      >
        <div className="space-y-1.5">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.code}
              onClick={() => {
                handleUpdatePreferences({ level: lvl.code as any });
                setShowLevelSelect(false);
              }}
              data-selected={preferences?.level === lvl.code}
              className="selection-card flex items-center justify-between"
            >
              <div className="text-left">
                <p className="font-medium text-[15px]">{lvl.name}</p>
                <p className="text-[13px] text-muted-foreground">{lvl.description}</p>
              </div>
              {preferences?.level === lvl.code && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
