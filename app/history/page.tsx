'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLearnedWords } from '@/lib/storage';
import type { LearnedWord } from '@/lib/types';

interface DayGroup {
  date: string;       // ISO "YYYY-MM-DD"
  label: string;      // "Today", "Yesterday", "Mon, 10 Jun", etc.
  words: LearnedWord[];
}

function dateLabel(dateStr: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone edge cases
  const todayStr = today.toISOString().split('T')[0];
  const yestStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yestStr) return 'Yesterday';

  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diffDays <= 6) {
    return d.toLocaleDateString('en-US', { weekday: 'long' }); // "Monday"
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }); // "Mon, 10 Jun"
}

function buildGroups(words: LearnedWord[]): DayGroup[] {
  const map = new Map<string, LearnedWord[]>();
  for (const w of words) {
    const date = w.learnedAt.split('T')[0];
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(w);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, ws]) => ({
      date,
      label: dateLabel(date),
      words: ws.sort((a, b) => b.learnedAt.localeCompare(a.learnedAt)),
    }));
}

const PAGE_SIZE = 14; // days per page
const PREVIEW_COUNT = 5; // words shown before "X more"

export default function HistoryPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [visibleDays, setVisibleDays] = useState(PAGE_SIZE);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    const words = getLearnedWords();
    setTotalWords(words.length);
    setGroups(buildGroups(words));
  }, []);

  const toggleExpand = (date: string) =>
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  const filtered = search.trim()
    ? groups
        .map(g => ({
          ...g,
          words: g.words.filter(
            w =>
              w.word.toLowerCase().includes(search.toLowerCase()) ||
              w.translation.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter(g => g.words.length > 0)
    : groups;

  const visible = filtered.slice(0, visibleDays);
  const hasMore = filtered.length > visibleDays;

  // Streak of consecutive study days
  const studyDates = new Set(groups.map(g => g.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (studyDates.has(ds)) streak++;
    else if (i > 0) break;
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-[var(--text)]">📖 Learning History</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{totalWords} words learned across {groups.length} days</p>

        {/* Stats strip */}
        <div className="flex gap-4 mt-3">
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--danger)]">🔥 {streak}</div>
            <div className="text-xs text-[var(--text-muted)]">day streak</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--primary)]">{groups.length}</div>
            <div className="text-xs text-[var(--text-muted)]">study days</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--success)]">
              {groups.length ? Math.round(totalWords / groups.length) : 0}
            </div>
            <div className="text-xs text-[var(--text-muted)]">avg/day</div>
          </div>
        </div>

        {/* Search */}
        {totalWords > 10 && (
          <div className="mt-3">
            <input
              type="text"
              placeholder="Filter by word or translation…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 p-4 space-y-3">
        {totalWords === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">No history yet</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">Words you learn will appear here.</p>
            <Link href="/learn" className="btn-primary inline-block">Start Learning</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">No results for "{search}"</div>
        ) : (
          <>
            {visible.map(group => (
              <DaySection
                key={group.date}
                group={group}
                expanded={expandedDates.has(group.date)}
                onToggle={() => toggleExpand(group.date)}
              />
            ))}

            {hasMore && (
              <button
                onClick={() => setVisibleDays(v => v + PAGE_SIZE)}
                className="w-full py-3 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Load {Math.min(PAGE_SIZE, filtered.length - visibleDays)} more days…
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DaySection({
  group, expanded, onToggle,
}: {
  group: DayGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const shown = expanded ? group.words : group.words.slice(0, PREVIEW_COUNT);
  const hidden = group.words.length - PREVIEW_COUNT;

  return (
    <div className="card">
      {/* Day header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-bold text-[var(--text)]">{group.label}</span>
          <span className="text-xs text-[var(--text-muted)] ml-2">{group.date}</span>
        </div>
        <span
          className="badge"
          style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
        >
          {group.words.length} word{group.words.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Word list */}
      <div className="space-y-1">
        {shown.map(w => (
          <Link
            key={w.word + w.collectionName}
            href={`/word/${encodeURIComponent(w.word)}`}
            className="flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors group"
          >
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--text)] group-hover:text-[var(--primary)] transition-colors">
                {w.word}
              </span>
              <span className="text-sm text-[var(--text-muted)] truncate">{w.translation}</span>
            </div>
            <span className="text-xs bg-[var(--surface-2)] text-[var(--text-muted)] px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline">
              {w.collectionName.split(' ')[0]}
            </span>
            <span className="text-[var(--text-muted)] text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">→</span>
          </Link>
        ))}
      </div>

      {/* Expand / collapse */}
      {group.words.length > PREVIEW_COUNT && (
        <button
          onClick={onToggle}
          className="mt-2 text-xs text-[var(--primary)] font-medium hover:underline w-full text-left pt-1 border-t border-[var(--border)]"
        >
          {expanded ? '▲ Show less' : `▼ Show ${hidden} more word${hidden !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
