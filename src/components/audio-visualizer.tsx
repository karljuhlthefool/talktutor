'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

export function AudioVisualizer({ analyser, isActive }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [bars, setBars] = useState<number[]>(new Array(32).fill(0));

  useEffect(() => {
    if (!analyser || !isActive) {
      setBars(new Array(32).fill(0));
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      // Sample 32 bars from frequency data
      const newBars: number[] = [];
      const step = Math.floor(dataArray.length / 32);
      for (let i = 0; i < 32; i++) {
        const value = dataArray[i * step];
        newBars.push(value / 255); // Normalize to 0-1
      }
      setBars(newBars);

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isActive]);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
      {/* Radial bars */}
      {bars.map((bar, i) => {
        const angle = (i / bars.length) * 360;
        const height = 20 + bar * 60; // 20-80px
        return (
          <div
            key={i}
            className="absolute w-1 origin-bottom transition-all duration-75"
            style={{
              height: `${height}px`,
              bottom: '50%',
              left: '50%',
              transform: `translateX(-50%) rotate(${angle}deg) translateY(-50%)`,
              background: `linear-gradient(to top, rgba(139, 92, 246, ${0.3 + bar * 0.5}), rgba(59, 130, 246, ${0.1 + bar * 0.3}))`,
              borderRadius: '2px',
            }}
          />
        );
      })}
    </div>
  );
}
