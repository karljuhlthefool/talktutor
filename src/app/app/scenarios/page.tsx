'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { SCENARIOS } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ScenariosPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = () => {
    if (selectedId) {
      // Store selection and go back to speak
      router.push('/app?scenario=' + selectedId);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#0c0c0e] px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Scenarios</h1>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => setSelectedId(scenario.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-3 p-6 rounded-2xl text-center transition-all',
              selectedId === scenario.id
                ? 'bg-purple-500/20 border-2 border-purple-500'
                : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
            )}
          >
            <span className="text-4xl">{scenario.icon}</span>
            <span className="text-sm font-medium">{scenario.name}</span>
          </button>
        ))}
      </div>

      {/* Random Option */}
      <button
        onClick={() => setSelectedId('random')}
        className={cn(
          'w-full flex items-center justify-center gap-3 p-4 rounded-2xl text-center transition-all mb-6',
          selectedId === 'random'
            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-purple-500'
            : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
        )}
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium">Surprise me!</span>
      </button>

      {/* Start Button */}
      <button
        onClick={handleSelect}
        disabled={!selectedId}
        className={cn(
          'w-full py-4 rounded-2xl font-medium text-lg transition-all',
          selectedId
            ? 'bg-gradient-to-r from-blue-500 to-purple-600'
            : 'bg-white/10 text-white/40'
        )}
      >
        {selectedId ? 'Start Practice' : 'Select a scenario'}
      </button>
    </div>
  );
}
