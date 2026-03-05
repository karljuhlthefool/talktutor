'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LANGUAGES, LEVELS } from '@/lib/types';
import { createClient } from '@/lib/auth-client';
import { upsertUserPreferences } from '@/lib/db-operations';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [language, setLanguage] = useState<string>(() => LANGUAGES[0]?.code || 'spanish');
  const [level, setLevel] = useState('intermediate');
  const [dialect, setDialect] = useState('');
  const [dailyGoal, setDailyGoal] = useState(10);

  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showDialectPicker, setShowDialectPicker] = useState(false);

  const selectedLanguage = LANGUAGES.find((l) => l.code === language);
  const selectedLevel = LEVELS.find((l) => l.code === level);

  const handleSkip = () => {
    router.push('/app');
  };

  const handleSubmit = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await upsertUserPreferences(user.id, {
          language: selectedLanguage?.name || 'Spanish',
          level: level as 'beginner' | 'intermediate' | 'advanced',
          dialect: dialect || selectedLanguage?.dialects?.[0],
          dailyGoalMinutes: dailyGoal,
        });
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
    router.push('/app');
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] px-4 py-6 flex flex-col">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`w-8 h-1 rounded-full transition-colors ${
              s <= step ? 'bg-purple-500' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="flex-1">
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">What language?</h1>
              <p className="text-white/60 text-sm">Pick the language you want to practice</p>
            </div>

            <div className="space-y-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
                    language === lang.code
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="font-medium">{lang.name}</span>
                  {language === lang.code && <Check className="w-5 h-5 text-purple-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Your level?</h1>
              <p className="text-white/60 text-sm">This helps us adapt the conversation</p>
            </div>

            <div className="space-y-3">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl.code}
                  onClick={() => setLevel(lvl.code)}
                  className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
                    level === lvl.code
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium">{lvl.name}</p>
                    <p className="text-sm text-white/60">{lvl.description}</p>
                  </div>
                  {level === lvl.code && <Check className="w-5 h-5 text-purple-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Dialect preference</h1>
              <p className="text-white/60 text-sm">Optional - helps with pronunciation</p>
            </div>

            <div className="space-y-3">
              {(selectedLanguage?.dialects || ['Standard']).map((d) => (
                <button
                  key={d}
                  onClick={() => setDialect(d)}
                  className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
                    dialect === d
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="font-medium">{d}</span>
                  {dialect === d && <Check className="w-5 h-5 text-purple-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Daily goal</h1>
              <p className="text-white/60 text-sm">How much practice per day?</p>
            </div>

            <div className="space-y-3">
              {[5, 10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setDailyGoal(mins)}
                  className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
                    dailyGoal === mins
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <span className="font-medium">{mins} minutes</span>
                  {dailyGoal === mins && <Check className="w-5 h-5 text-purple-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-6">
        {step < 4 ? (
          <>
            <Button
              onClick={() => setStep(step + 1)}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 font-medium text-lg"
            >
              Continue
            </Button>
            <button
              onClick={handleSkip}
              className="w-full py-3 text-white/60 hover:text-white text-sm"
            >
              Skip for now
            </button>
          </>
        ) : (
          <Button
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 font-medium text-lg"
          >
            Start speaking
          </Button>
        )}
      </div>
    </div>
  );
}
