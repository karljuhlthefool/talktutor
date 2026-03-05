'use client';

import { useState, useEffect } from 'react';
import { Search, ArrowLeft, BookOpen, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/auth-client';
import { getDictionaryEntries, deleteDictionaryEntry } from '@/lib/db-operations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DictionaryEntry } from '@/lib/types';

export default function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null);

  // Fetch entries from Supabase
  useEffect(() => {
    async function fetchEntries() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const data = await getDictionaryEntries(user.id);
          setEntries(data || []);
        } else {
          // Fallback mock data for demo/unauthenticated
          const mockEntries: DictionaryEntry[] = [
            { id: '1', userId: 'demo', language: 'Spanish', term: 'café', meaning: 'Coffee shop', example: 'Voy a tomar un café.', scenario: 'cafe', createdAt: new Date() },
            { id: '2', userId: 'demo', language: 'Spanish', term: 'mesa', meaning: 'Table', example: 'Una mesa para dos, por favor.', scenario: 'restaurant', createdAt: new Date() },
          ];
          setEntries(mockEntries);
        }
      } catch (err) {
        console.error('Failed to fetch dictionary:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEntries();
  }, []);

  const filteredEntries = entries.filter((entry) =>
    searchQuery === '' ||
    entry.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.meaning?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const todayEntries = filteredEntries.filter(
    (e) => new Date(e.createdAt).toDateString() === new Date().toDateString()
  );

  const olderEntries = filteredEntries.filter(
    (e) => new Date(e.createdAt).toDateString() !== new Date().toDateString()
  );

  if (selectedEntry) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-[#0c0c0e] px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setSelectedEntry(null)}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{selectedEntry.term}</h1>
        </div>

        {/* Word Details */}
        <div className="space-y-6">
          <div className="bg-white/5 rounded-2xl p-6">
            <p className="text-sm text-white/60 mb-2">Meaning</p>
            <p className="text-lg">{selectedEntry.meaning || '—'}</p>
          </div>

          {selectedEntry.example && (
            <div className="bg-white/5 rounded-2xl p-6">
              <p className="text-sm text-white/60 mb-2">Example</p>
              <p className="text-lg italic">"{selectedEntry.example}"</p>
            </div>
          )}

          {selectedEntry.scenario && (
            <div className="bg-white/5 rounded-2xl p-6">
              <p className="text-sm text-white/60 mb-2">Learned in</p>
              <p className="text-lg">{selectedEntry.scenario}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start text-left"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Add to flashcards
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-red-400"
              onClick={async () => {
                try {
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user && selectedEntry) {
                    await deleteDictionaryEntry(selectedEntry.id, user.id);
                    setEntries(prev => prev.filter(e => e.id !== selectedEntry.id));
                    setSelectedEntry(null);
                  }
                } catch (err) {
                  console.error('Failed to delete entry:', err);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#0c0c0e] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dictionary</h1>
        <span className="text-sm text-white/60">{entries.length} words</span>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 w-5 h-5 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words..."
            className="pl-10 h-12 bg-white/5 border-0 rounded-xl"
          />
        </div>
      </div>

      {/* Word List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today */}
          {todayEntries.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-white/60 mb-3">New today</h2>
              <div className="space-y-2">
                {todayEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full bg-white/5 hover:bg-white/10 rounded-xl p-4 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-lg">{entry.term}</p>
                        <p className="text-sm text-white/60">{entry.meaning}</p>
                      </div>
                      {entry.scenario && (
                        <span className="text-xs text-white/40 bg-white/10 px-2 py-1 rounded">
                          {entry.scenario}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent */}
          {olderEntries.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-white/60 mb-3">Recent</h2>
              <div className="space-y-2">
                {olderEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full bg-white/5 hover:bg-white/10 rounded-xl p-4 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-lg">{entry.term}</p>
                        <p className="text-sm text-white/60">{entry.meaning}</p>
                      </div>
                      {entry.scenario && (
                        <span className="text-xs text-white/40 bg-white/10 px-2 py-1 rounded">
                          {entry.scenario}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredEntries.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-white/20 mb-4" />
              <p className="text-white/60">
                {searchQuery ? 'No words found' : 'Start a conversation to learn new words!'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
