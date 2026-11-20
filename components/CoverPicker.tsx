'use client';
// Folder / unit covers (Library + My Words). Mirrors lexivo
// lib/widgets/folder_cover.dart: CoverTile = CoverCard, CoverPicker = showCoverPicker.
import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  COVER_GRADIENTS, COVER_ICON_GROUPS, coverBackground, coverColor, coverT, encodeCover, parseCover, searchCoverIcons,
  uploadCoverImage, type CoverSpec,
} from '@/lib/folder-cover';
import { getUILanguage } from '@/lib/storage';

const darken = (hex: string, amt = 0.45) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
};
const lighten = (hex: string, amt = 0.3) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
};

/** The emoji of an emoji cover, drawn big in the box's top-right corner. */
export function CoverEmoji({ cover, size = 40 }: { cover: CoverSpec | null; size?: number }) {
  if (!cover?.emoji || cover.imageUrl) return null;
  return (
    <span className="absolute pointer-events-none select-none" style={{ right: '10%', top: '12%', fontSize: size, lineHeight: 1, opacity: 0.9 }}>
      {cover.emoji}
    </span>
  );
}

/**
 * The raised folder/unit card of Library and My Words, painted with `cover`
 * when set, else the grid's `color` gradient as before. Wrap it in a Link.
 */
export function CoverTile({ cover, color, icon, name, subtitle }: {
  cover: string | null | undefined; color: string; icon: string; name: string; subtitle: string;
}) {
  const spec = parseCover(cover);
  const base = spec ? coverColor(spec) : color;
  const showIcon = !spec || (!spec.emoji && !spec.imageUrl);
  return (
    <div
      className="rounded-2xl cursor-pointer animate-heartbeat hover:-translate-y-1 transition-all duration-200 relative overflow-hidden"
      style={{
        ...(spec ? coverBackground(spec) : { background: `linear-gradient(135deg, ${lighten(color)}, ${color})` }),
        boxShadow: `0 12px 0 ${darken(base)}, 0 16px 32px ${base}99`,
        minHeight: '120px',
      }}
    >
      <CoverEmoji cover={spec} size={36} />
      <div className="p-4 text-2xl">{showIcon ? icon : ' '}</div>
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3" style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)' }}>
        <p className="text-white font-bold text-sm leading-tight line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{name}</p>
        <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/**
 * Modal to choose a cover. onPick gets '' to remove the cover (default look /
 * use the folder's), else the new cover string. `isUnit` only changes the
 * remove button's wording.
 */
export default function CoverPicker({ current, isUnit = false, onClose, onPick }: {
  current: string | null | undefined; isUnit?: boolean; onClose: () => void; onPick: (cover: string) => void;
}) {
  const { user } = useAuth();
  const start = parseCover(current);
  const [gradient, setGradient] = useState(start?.gradient ?? 0);
  const [emoji, setEmoji] = useState<string | undefined>(start?.emoji);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  // Open on the tab holding the current icon, else the first.
  const [group, setGroup] = useState(() =>
    Math.max(0, COVER_ICON_GROUPS.findIndex(g => g.icons.some(([e]) => e === start?.emoji))));
  const fileRef = useRef<HTMLInputElement>(null);
  const preview: CoverSpec = { gradient, emoji };
  const lang = (['uz', 'ru'].includes(getUILanguage()) ? getUILanguage() : 'en') as 'en' | 'uz' | 'ru';
  const shown = query.trim() ? searchCoverIcons(query) : COVER_ICON_GROUPS[group].icons.map(([e]) => e);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true);
    try {
      onPick(await uploadCoverImage(file, user.id));
    } catch (err) {
      console.error('[CoverPicker] upload failed', err);
      alert(coverT('uploadFailed'));
      setUploading(false);
    }
  }

  const label = 'text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mt-4 mb-2';
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[var(--text)] mb-3">{coverT('cover')}</h2>
        <div className="relative h-24 rounded-2xl overflow-hidden" style={coverBackground(preview)}>
          <CoverEmoji cover={preview} size={44} />
        </div>

        {user && (
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold border-[1.5px] border-[var(--primary)]/40 text-[var(--primary)] disabled:opacity-50"
            >🖼 {coverT(uploading ? 'uploading' : 'upload')}</button>
          </>
        )}

        <p className={label}>{coverT('colour')}</p>
        <div className="flex flex-wrap gap-2.5">
          {COVER_GRADIENTS.map(([a, b], i) => (
            <button
              key={i}
              onClick={() => setGradient(i)}
              aria-label={`${coverT('colour')} ${i + 1}`}
              className="w-9 h-9 rounded-full"
              style={{ background: `linear-gradient(135deg, ${a}, ${b})`, outline: gradient === i ? '3px solid var(--text)' : 'none', outlineOffset: 2 }}
            />
          ))}
        </div>

        <p className={label}>{coverT('icon')}</p>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={coverT('search')}
          className="w-full px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] mb-2"
        />
        {!query.trim() && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 -mx-1 px-1">
            {COVER_ICON_GROUPS.map((g, i) => (
              <button
                key={g.label.en}
                onClick={() => setGroup(i)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                style={group === i
                  ? { background: 'var(--primary)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >{g.icons[0][0]} {g.label[lang]}</button>
            ))}
          </div>
        )}
        {shown.length === 0 && <p className="text-xs text-[var(--text-muted)] py-3 text-center">{coverT('noResults')}</p>}
        <div className="flex flex-wrap gap-1.5">
          {shown.map(e => (
            <button
              key={e}
              onClick={() => setEmoji(emoji === e ? undefined : e)}
              className="w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2"
              style={{
                background: emoji === e ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--surface-2)',
                borderColor: emoji === e ? 'var(--primary)' : 'transparent',
              }}
            >{e}</button>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          {current ? (
            <button onClick={() => onPick('')} disabled={uploading} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
              {coverT(isUnit ? 'resetUnit' : 'resetFolder')}
            </button>
          ) : (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
              {coverT('cancel')}
            </button>
          )}
          <button onClick={() => onPick(encodeCover(preview))} disabled={uploading} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[var(--primary)] disabled:opacity-50">
            {coverT('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
