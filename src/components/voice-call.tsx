'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Phone, PhoneOff, ChevronDown, AlertCircle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SCENARIOS, type TranscriptEntry, type Correction } from '@/lib/types';
import { getTrialState, startTrial, endTrial } from '@/lib/trial';
import { TrialExpiredModal } from './trial-expired-modal';
import { AudioVisualizer } from './audio-visualizer';

interface VoiceCallProps {
  onEnd: (data: {
    durationSeconds: number;
    transcript: TranscriptEntry[];
    corrections: Correction[];
    newWords: Array<{ term: string; meaning?: string }>;
    scenario?: string;
  }) => void;
}

type CallStatus = 'idle' | 'connecting' | 'active' | 'paused' | 'ended';

export function VoiceCall({ onEnd }: VoiceCallProps) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [scenario, setScenario] = useState<string | null>(null);
  const [showScenarioPicker, setShowScenarioPicker] = useState(true);
  const [trialRemaining, setTrialRemaining] = useState<number | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [latestCorrection, setLatestCorrection] = useState<Correction | null>(null);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [error, setError] = useState<'mic-denied' | 'connection-lost' | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check trial state on mount
  useEffect(() => {
    const trial = getTrialState();
    if (trial.isTrial && !trial.expired) {
      setTrialRemaining(Math.max(0, trial.remaining));
    } else if (trial.expired) {
      setShowTrialModal(true);
    }
  }, []);

  // Update trial remaining every second
  useEffect(() => {
    if (status !== 'active' || trialRemaining === null) return;

    const interval = setInterval(() => {
      const trial = getTrialState();
      if (trial.expired && !showTrialModal) {
        setShowTrialModal(true);
        handleEndCall();
      } else if (trial.remaining > 0) {
        setTrialRemaining(Math.max(0, trial.remaining));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status, trialRemaining, showTrialModal]);

  // Start timer when call is active
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  // Initialize audio context for visualization
  useEffect(() => {
    if (status === 'active') {
      try {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;

          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 256;
          analyserRef.current = analyser;
        });
      } catch (err) {
        console.error('Failed to get microphone:', err);
      }
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (analyserRef.current) {
        analyserRef.current = null;
      }
    };
  }, [status]);

  const handleStartCall = async () => {
    setError(null);
    startTrial();

    setStatus('connecting');
    setShowScenarioPicker(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // TODO: Connect to Google Live API
      // For now, simulate connection
      setTimeout(() => {
        setStatus('active');
        setDuration(0);

        // Add welcome message
        setTranscript([{
          role: 'assistant',
          content: '¡Hola! Pick a scenario to practice: (1) Café order, (2) Restaurant, (3) Meeting a friend. Say 1, 2, or 3!',
          timestamp: new Date().toISOString(),
        }]);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to start call:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError('mic-denied');
      } else {
        setError('connection-lost');
      }
      setStatus('idle');
    }
  };

  const handleEndCall = async () => {
    setStatus('ended');

    // End trial session
    endTrial();

    // Prepare new words from corrections
    const newWords = corrections.map((c) => ({
      term: c.corrected,
      meaning: c.original,
    }));

    // Save session to Supabase
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'Spanish',
          scenario,
          durationSeconds: duration,
          transcript,
          newWords,
        }),
      });
    } catch (err) {
      console.error('Failed to save session:', err);
    }

    // Navigate to recap
    onEnd({
      durationSeconds: duration,
      transcript,
      corrections,
      newWords,
      scenario: scenario || undefined,
    });
  };

  const handleScenarioSelect = (scenarioId: string) => {
    const selected = SCENARIOS.find((s) => s.id === scenarioId);
    setScenario(selected?.name || null);
    setShowScenarioPicker(false);

    // Add scenario start message
    setTranscript((prev) => [...prev, {
      role: 'assistant',
      content: `Great choice! Let's practice "${selected?.name}". I'll be your conversation partner. Start whenever you're ready!`,
      timestamp: new Date().toISOString(),
    }]);
  };

  const addCorrection = (correction: Correction) => {
    setCorrections((prev) => [...prev, correction]);
    setLatestCorrection(correction);

    // Add to transcript
    setTranscript((prev) => [...prev, {
      role: 'assistant',
      content: `Correction: "${correction.original}" → "${correction.corrected}"`,
      timestamp: new Date().toISOString(),
      correction,
    }]);
  };

  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {/* Error State */}
        {error === 'mic-denied' && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/30 rounded-xl max-w-sm text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="font-medium text-red-400">Microphone Access Denied</p>
            <p className="text-sm text-white/60 mt-1">Please allow microphone access in your browser settings and try again.</p>
          </div>
        )}
        {error === 'connection-lost' && (
          <div className="mb-8 p-4 bg-orange-500/20 border border-orange-500/30 rounded-xl max-w-sm text-center">
            <WifiOff className="w-8 h-8 text-orange-400 mx-auto mb-2" />
            <p className="font-medium text-orange-400">Connection Lost</p>
            <p className="text-sm text-white/60 mt-1">Unable to connect. Please check your internet and try again.</p>
          </div>
        )}

        <div className="text-center mb-8">
          <p className="text-xl font-semibold">Ready to practice?</p>
          <p className="text-white/60 text-sm mt-2">Tap the button below to start</p>
        </div>
        <button
          onClick={handleStartCall}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-transform"
        >
          <Phone className="w-10 h-10 text-white" />
        </button>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative w-24 h-24 mb-4">
          {/* Outer ring animation */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/40 to-purple-600/40 animate-ping" />
          {/* Middle ring */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-500/60 to-purple-600/60 animate-pulse" />
          {/* Inner circle */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Mic className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>
        <p className="text-lg font-medium animate-pulse">Connecting...</p>
        <p className="text-sm text-white/40 mt-2">Setting up your session</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            )}
          />
          <span className="text-sm font-medium capitalize">{status}</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-lg font-mono">{formatDuration(duration)}</span>
          {trialRemaining !== null && (
            <span className="text-xs text-white/60">
              Trial: {Math.floor(trialRemaining / 60)}:{Math.floor(trialRemaining % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>

        <button
          onClick={handleEndCall}
          className="px-4 py-2 rounded-full bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30"
        >
          End
        </button>
      </div>

      {/* Scenario Picker */}
      {showScenarioPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#1a1a1c] rounded-t-3xl p-6 animate-in slide-up-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Choose a Scenario</h3>
              <button
                onClick={() => setShowScenarioPicker(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SCENARIOS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => handleScenarioSelect(s.id)}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-xl text-left transition-all animate-in fade-in-up duration-200',
                    scenario === s.name
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  )}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-sm font-medium">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Audio Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Waveform/Orb */}
        <div className="relative w-48 h-48 mb-8">
          <div
            className={cn(
              'absolute inset-0 rounded-full transition-all duration-500',
              status === 'active'
                ? 'bg-gradient-to-br from-blue-500/30 to-purple-600/30'
                : 'bg-white/5'
            )}
          >
            {/* Audio visualizer bars */}
            {status === 'active' && analyserRef.current && (
              <AudioVisualizer analyser={analyserRef.current} isActive={status === 'active'} />
            )}
            <div className="absolute inset-4 rounded-full bg-[#0c0c0e] flex items-center justify-center z-10">
              <Mic
                className={cn(
                  'w-16 h-16 transition-all',
                  status === 'active' ? 'text-blue-400' : 'text-white/40'
                )}
              />
            </div>
          </div>
          {/* Audio visualization rings */}
          {status === 'active' && analyserRef.current && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
              <div className="absolute inset-[-10px] rounded-full border border-purple-500/20 animate-pulse" />
            </>
          )}
        </div>

        {/* Scenario Info */}
        {scenario && (
          <p className="text-sm text-white/60 mb-4">
            Scenario: <span className="text-white font-medium">{scenario}</span>
          </p>
        )}

        {/* Action Chips */}
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => {
              // TODO: Implement translate last
              setTranscript((prev) => [...prev, {
                role: 'assistant',
                content: 'Last message translation would appear here...',
                timestamp: new Date().toISOString(),
              }]);
            }}
            className="px-4 py-2 rounded-full bg-white/5 text-sm text-white/80 hover:bg-white/10"
          >
            Translate last
          </button>
          <button
            onClick={() => {
              // TODO: Implement slow down
              setTranscript((prev) => [...prev, {
                role: 'assistant',
                content: 'Of course, I can speak more slowly...',
                timestamp: new Date().toISOString(),
              }]);
            }}
            className="px-4 py-2 rounded-full bg-white/5 text-sm text-white/80 hover:bg-white/10"
          >
            Slow down
          </button>
          <button
            onClick={() => {
              // TODO: Implement repeat
              setTranscript((prev) => [...prev, {
                role: 'assistant',
                content: 'Let me repeat that...',
                timestamp: new Date().toISOString(),
              }]);
            }}
            className="px-4 py-2 rounded-full bg-white/5 text-sm text-white/80 hover:bg-white/10"
          >
            Repeat
          </button>
        </div>
      </div>

      {/* Transcript Drawer */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full py-3 flex items-center justify-center gap-2 text-white/60 hover:text-white"
        >
          <span className="text-sm">Transcript</span>
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform',
              showTranscript && 'rotate-180'
            )}
          />
        </button>

        {showTranscript && (
          <div className="max-h-48 overflow-y-auto px-4 pb-4 space-y-2">
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  'text-sm p-3 rounded-xl',
                  entry.role === 'user'
                    ? 'bg-blue-500/20 ml-8'
                    : 'bg-white/5 mr-8'
                )}
              >
                {entry.correction && (
                  <p className="text-xs text-orange-400 mb-1">
                    Correction: {entry.correction.original} → {entry.correction.corrected}
                  </p>
                )}
                <p className={entry.correction ? 'text-white/80' : ''}>
                  {entry.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Latest Correction Toast */}
      {latestCorrection && (
        <div className="fixed top-4 left-4 right-4 bg-orange-500/20 border border-orange-500/30 rounded-xl p-4 z-50">
          <p className="text-sm font-medium text-orange-400 mb-1">Correction</p>
          <p className="text-sm">
            <span className="text-white/60">You said:</span>{' '}
            <span className="line-through text-white/40">{latestCorrection.original}</span>
          </p>
          <p className="text-sm">
            <span className="text-white/60">Try:</span>{' '}
            <span className="text-green-400 font-medium">{latestCorrection.corrected}</span>
          </p>
          <button
            onClick={() => setLatestCorrection(null)}
            className="absolute top-2 right-2 text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Trial Expired Modal */}
      {showTrialModal && <TrialExpiredModal />}
    </div>
  );
}
