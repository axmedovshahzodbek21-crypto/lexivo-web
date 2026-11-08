/* eslint-disable @typescript-eslint/no-explicit-any -- rows default to any, like the raw query results these replace */
// Two server limits break naive reads once a class or folder gets big:
//   * a request listing ids in `.in()` fails with 400 somewhere between 500
//     and 700 uuids (measured 2026-11-08: the id list lives in the URL);
//   * a read returns at most 1000 rows, silently dropping the rest.
// Mirrors lexivo lib/services/fetch_in_chunks.dart.

const ID_CHUNK = 200;
const PAGE = 1000;

interface Rangeable {
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
}

/** Reads every page of a query. `build` must return a fresh query with a stable `.order()`. */
export async function fetchAllPages<T = any>(build: () => Rangeable): Promise<{ data: T[]; error: any }> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { data: [], error };
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGE) return { data: out, error: null };
  }
}

/** Same as one `.in(column, ids)` read, for any number of ids. `build` gets one
 *  slice of ids and must return a fresh query with a stable `.order()`. */
export async function selectInChunks<T = any>(
  ids: string[],
  build: (chunk: string[]) => Rangeable,
): Promise<{ data: T[]; error: any }> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));
  const results = await Promise.all(chunks.map(chunk => fetchAllPages<T>(() => build(chunk))));
  const failed = results.find(r => r.error);
  if (failed) return { data: [], error: failed.error };
  return { data: results.flatMap(r => r.data), error: null };
}
