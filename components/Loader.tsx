// Shared loading states — replaces bouncing emoji loaders throughout the app.

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="w-8 h-8 rounded-full border-[3px] border-[var(--border)] border-t-[var(--primary)] animate-spin" />
      <p className="text-sm font-medium text-[var(--text-muted)]">Loading…</p>
    </div>
  );
}

export function SectionLoader({ rows = 4 }: { rows?: number }) {
  return (
    <div className="px-4 py-6 space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-14 rounded-xl" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

export function CardRowLoader({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16 rounded-2xl mx-4" style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}
