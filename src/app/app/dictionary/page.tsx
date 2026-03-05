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

  useEffect(() => {
    async function fetchEntries() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const data = await getDictionaryEntries(user.id);
          setEntries(data || []);
        } else {
          const mockEntries: DictionaryEntry[] = [
            { id: '1', userId: 'demo', language: 'Spanish', term: 'cafe', meaning: 'Coffee shop', example: 'Voy a tomar un cafe.', scenario: 'cafe', createdAt: new Date() },
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
      <div className="min-h-[calc(100dvh-5rem)] bg-background px-5 py-6 md:py-8 md:max-w-2xl md:mx-auto animate-in">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSelectedEntry(null)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-semibold">{selectedEntry.term}</h1>
        </div>

        <div className="space-y-3">
          <div className="bg-accent rounded-xl p-5">
            <p className="text-[13px] text-muted-foreground mb-1.5">Meaning</p>
            <p className="text-[15px]">{selectedEntry.meaning || '—'}</p>
          </div>

          {selectedEntry.example && (
            <div className="bg-accent rounded-xl p-5">
              <p className="text-[13px] text-muted-foreground mb-1.5">Example</p>
              <p className="text-[15px] italic text-foreground/80">&ldquo;{selectedEntry.example}&rdquo;</p>
            </div>
          )}

          {selectedEntry.scenario && (
            <div className="bg-accent rounded-xl p-5">
              <p className="text-[13px] text-muted-foreground mb-1.5">Learned in</p>
              <p className="text-[15px] capitalize">{selectedEntry.scenario}</p>
            </div>
          )}

          <div className="pt-4 space-y-1.5">
            <Button
              variant="ghost"
              className="w-full justify-start rounded-xl"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Add to flashcards
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
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
    <div className="min-h-[calc(100dvh-5rem)] bg-background px-5 py-6 md:py-8 md:max-w-2xl md:mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Dictionary</h1>
        <span className="text-[13px] text-muted-foreground tabular-nums">{entries.length} words</span>
      </div>

      <div className="mb-5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words..."
            className="pl-10 h-11 bg-accent border-0 rounded-xl text-[15px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {todayEntries.length > 0 && (
            <div>
              <p className="text-[13px] font-medium text-muted-foreground mb-2 px-1">New today</p>
              <div className="space-y-1">
                {todayEntries.map((entry, i) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="list-item-in w-full bg-accent hover:bg-secondary rounded-xl p-4 text-left transition-colors"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[15px]">{entry.term}</p>
                        <p className="text-[13px] text-muted-foreground">{entry.meaning}</p>
                      </div>
                      {entry.scenario && (
                        <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                          {entry.scenario}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {olderEntries.length > 0 && (
            <div>
              <p className="text-[13px] font-medium text-muted-foreground mb-2 px-1">Recent</p>
              <div className="space-y-1">
                {olderEntries.map((entry, i) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="list-item-in w-full bg-accent hover:bg-secondary rounded-xl p-4 text-left transition-colors"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[15px]">{entry.term}</p>
                        <p className="text-[13px] text-muted-foreground">{entry.meaning}</p>
                      </div>
                      {entry.scenario && (
                        <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                          {entry.scenario}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredEntries.length === 0 && (
            <div className="text-center py-16">
              <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No words found' : 'Start a conversation to learn new words'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
