import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TrialExpiredModal() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setLoading(false);

      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } catch (err) {
      setLoading(false);
      setError('Failed to send magic link');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0c0c0e] rounded-2xl p-6 max-w-md w-full relative">
        {/* Close button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4 text-white/40 hover:text-white"
        >
          ✕
        </button>

        {/* Content */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-orange-500/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">⏱</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Trial Complete!</h2>
          <p className="text-white/60 mb-6">
            Your <span className="text-orange-400 font-medium">1.5 minutes</span> of free practice is up!
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-green-400">✓</span>
            </div>
            <p className="text-white/60 mb-2">
              Magic link sent!
            </p>
            <p className="text-sm text-white/40 mt-4">
              Check your inbox and click the link to continue.
            </p>
          </div>
        ) : (
          <>
            <p className="text-white/60 mb-4">
              Create an account to save your progress and unlock unlimited practice time
            </p>

            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            <div className="mb-4">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                disabled={loading}
                className="h-14 rounded-xl bg-white/5 border-border text-white"
              />
            </div>

            <Button
              onClick={handleSendMagicLink}
              disabled={loading || !email}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 font-medium"
            >
              {loading ? 'Sending...' : 'Continue with Magic Link'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
