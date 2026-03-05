'use client';

import { useRef, useState, useCallback } from 'react';
import type { TranscriptEntry, Correction, SessionStatus } from './types';

interface VoiceOrchestratorOptions {
  language: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  dialect?: string;
  systemPrompt?: string;
}

interface VoiceOrchestratorState {
  status: SessionStatus;
  durationSeconds: number;
  transcript: TranscriptEntry[];
  corrections: Correction[];
  newWords: Array<{ term: string; meaning?: string; example?: string }>;
}

export function useVoiceOrchestrator(options: VoiceOrchestratorOptions) {
  const { language, level, dialect } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [state, setState] = useState<VoiceOrchestratorState>({
    status: 'idle',
    durationSeconds: 0,
    transcript: [],
    corrections: [],
    newWords: [],
  });

  // Generate system prompt based on options
  const getSystemPrompt = useCallback(() => {
    const levelInstructions = {
      beginner: 'Use simple vocabulary and speak slowly. Repeat things if needed.',
      intermediate: 'Use moderate vocabulary and normal pace. Challenge the user slightly.',
      advanced: 'Use advanced vocabulary and idioms. Speak at natural pace.',
    };

    return `You are a friendly language tutor helping a user practice ${language}${dialect ? ` (${dialect} dialect)` : ''}.

${levelInstructions[level]}

Guidelines:
- Respond naturally in ${language}
- Gently correct major mistakes
- Keep the conversation engaging
- Be patient and encouraging`;
  }, [language, level, dialect]);

  // Add entry to transcript
  const addTranscriptEntry = useCallback((role: 'user' | 'assistant', content: string) => {
    setState(prev => ({
      ...prev,
      transcript: [
        ...prev.transcript,
        { role, content, timestamp: new Date().toISOString() },
      ],
    }));
  }, []);

  // Add correction
  const addCorrection = useCallback((original: string, corrected: string) => {
    const correction: Correction = { original, corrected };
    setState(prev => ({
      ...prev,
      corrections: [...prev.corrections, correction],
    }));
  }, []);

  // Add new word
  const addNewWord = useCallback((term: string, meaning?: string, example?: string) => {
    setState(prev => ({
      ...prev,
      newWords: [...prev.newWords, { term, meaning, example }],
    }));
  }, []);

  // Start session
  const startSession = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'connecting' }));

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Initialize audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create analyser for visualization
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      setState(prev => ({ ...prev, status: 'active' }));

      // Start timer
      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          durationSeconds: prev.durationSeconds + 1,
        }));
      }, 1000);

      // TODO: Connect to Google Live API
      // For now, simulate with a welcome message
      addTranscriptEntry('assistant', '¡Hola! Ready to practice? Pick a scenario and let\'s begin!');

    } catch (error) {
      console.error('Failed to start session:', error);
      setState(prev => ({ ...prev, status: 'ended' }));
    }
  }, [addTranscriptEntry]);

  // End session
  const endSession = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setState(prev => ({ ...prev, status: 'ended' }));
  }, []);

  // Get analyser for visualization
  const getAnalyser = useCallback(() => analyserRef.current, []);

  return {
    ...state,
    startSession,
    endSession,
    addTranscriptEntry,
    addCorrection,
    addNewWord,
    getAnalyser,
    systemPrompt: getSystemPrompt(),
  };
}
