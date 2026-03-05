'use client';

import { useRef, useCallback } from 'react';

const WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// Latest native audio model for Gemini Live API
const MODEL = 'models/gemini-2.5-flash-native-audio-latest';

const TARGET_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const PROCESSOR_BUFFER_SIZE = 4096;

// Downsample Float32 PCM from native rate to target rate, return Int16
function downsampleToInt16(buffer: Float32Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) {
    const out = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      out[i] = Math.max(-32768, Math.min(32767, buffer[i] * 32768));
    }
    return out;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const out = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, buffer.length - 1);
    const frac = srcIdx - lo;
    const sample = buffer[lo] * (1 - frac) + buffer[hi] * frac;
    out[i] = Math.max(-32768, Math.min(32767, sample * 32768));
  }

  return out;
}

function int16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

interface UseGeminiLiveOptions {
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  onError: (err: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

interface UseGeminiLiveReturn {
  connect: (stream: MediaStream, audioContext: AudioContext, systemPrompt: string) => void;
  disconnect: () => void;
  sendTextMessage: (text: string) => void;
}

export function useGeminiLive({
  onTranscript,
  onError,
  onStatusChange,
}: UseGeminiLiveOptions): UseGeminiLiveReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Keep stable refs to callbacks so closures inside ws.onmessage stay fresh
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;
  onStatusChangeRef.current = onStatusChange;

  const scheduleAudioChunk = useCallback((int16: Int16Array, ctx: AudioContext) => {
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(nextPlayTimeRef.current, now);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  const connect = useCallback(
    (stream: MediaStream, audioContext: AudioContext, systemPrompt: string) => {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        onErrorRef.current('Gemini API key not configured. Set NEXT_PUBLIC_GEMINI_API_KEY.');
        return;
      }

      // Close any existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = 0;

      const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(apiKey)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: MODEL,
              generation_config: {
                response_modalities: ['AUDIO'],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: {
                      voice_name: 'Puck',
                    },
                  },
                },
              },
              system_instruction: {
                parts: [{ text: systemPrompt }],
              },
            },
          })
        );
      };

      ws.onmessage = async (event) => {
        // Gemini sends binary Blob frames — read to text before parsing
        const raw: string =
          event.data instanceof Blob ? await event.data.text() : (event.data as string);

        let data: Record<string, unknown>;
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }

        // Setup complete — begin streaming mic audio
        if (data.setupComplete) {
          onStatusChangeRef.current('connected');

          const sourceNode = audioContext.createMediaStreamSource(stream);
          sourceNodeRef.current = sourceNode;
          const processor = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
          processorRef.current = processor;

          // Silent gain so the processor fires without echoing mic back to speakers
          const muteGain = audioContext.createGain();
          muteGain.gain.value = 0;
          muteGainRef.current = muteGain;

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const downsampled = downsampleToInt16(inputData, audioContext.sampleRate, TARGET_SAMPLE_RATE);
            const b64 = int16ToBase64(downsampled);

            ws.send(
              JSON.stringify({
                realtime_input: {
                  media_chunks: [
                    {
                      mime_type: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`,
                      data: b64,
                    },
                  ],
                },
              })
            );
          };

          sourceNode.connect(processor);
          processor.connect(muteGain);
          muteGain.connect(audioContext.destination);
        }

        // Server content: audio + transcriptions
        const serverContent = data.serverContent as Record<string, unknown> | undefined;
        if (serverContent) {
          // Audio output from model
          const modelTurn = serverContent.modelTurn as Record<string, unknown> | undefined;
          if (modelTurn?.parts) {
            for (const part of modelTurn.parts as Array<Record<string, unknown>>) {
              const inlineData = part.inlineData as Record<string, unknown> | undefined;
              if (inlineData?.data && typeof inlineData.mimeType === 'string' && inlineData.mimeType.includes('audio')) {
                const int16 = base64ToInt16(inlineData.data as string);
                scheduleAudioChunk(int16, audioContext);
              }
            }
          }

          // Output transcription (what the AI said)
          const outputTranscription = serverContent.outputTranscription as Record<string, unknown> | undefined;
          if (outputTranscription?.text && typeof outputTranscription.text === 'string') {
            onTranscriptRef.current(outputTranscription.text, 'assistant');
          }

          // Input transcription (what the user said, if supported by model)
          const inputTranscription = serverContent.inputTranscription as Record<string, unknown> | undefined;
          if (inputTranscription?.text && typeof inputTranscription.text === 'string') {
            onTranscriptRef.current(inputTranscription.text, 'user');
          }
        }
      };

      ws.onerror = (err) => {
        console.error('Gemini Live WS error:', err);
        onErrorRef.current('Connection error — please check your network and try again.');
        onStatusChangeRef.current('disconnected');
      };

      ws.onclose = (evt) => {
        // Only report unexpected disconnects (not from our own disconnect() call)
        if (evt.code !== 1000 && evt.code !== 1001) {
          console.warn('Gemini Live WS closed unexpectedly:', evt.code, evt.reason);
        }
        onStatusChangeRef.current('disconnected');
      };
    },
    [scheduleAudioChunk]
  );

  const disconnect = useCallback(() => {
    // Tear down mic capture chain: sourceNode → processor → muteGain → destination
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (muteGainRef.current) {
      muteGainRef.current.disconnect();
      muteGainRef.current = null;
    }

    // Close WebSocket cleanly
    if (wsRef.current) {
      wsRef.current.close(1000, 'session ended');
      wsRef.current = null;
    }

    nextPlayTimeRef.current = 0;
    audioContextRef.current = null;
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        client_content: {
          turns: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          turn_complete: true,
        },
      })
    );
  }, []);

  return { connect, disconnect, sendTextMessage };
}
