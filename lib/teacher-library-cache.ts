// Module-level in-memory caches for the teacher Library pages
// (app/library/page.tsx, app/library/[folderId]/page.tsx,
// app/library/[folderId]/[unitId]/page.tsx). Centralized here (instead of
// each page declaring its own `_cache` const) so they can all be wiped from
// one place on logout — previously nothing ever cleared them, so on a
// shared browser a second teacher signing in right after the first signed
// out could briefly see the first teacher's cached folder/unit/word data
// flash on screen before the fresh fetch for the new account resolved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const folderListCache: Record<string, any[]> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const folderCache: Record<string, { name: string; units: any[] }> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unitCache: Record<string, { unitName: string; folderName: string; words: any[] }> = {};

export function clearTeacherLibraryCaches(): void {
  for (const k of Object.keys(folderListCache)) delete folderListCache[k];
  for (const k of Object.keys(folderCache)) delete folderCache[k];
  for (const k of Object.keys(unitCache)) delete unitCache[k];
}
