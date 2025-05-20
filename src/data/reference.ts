/** Lowercase letters and digits only, accents dropped: "U-turn" → "uturn", "Poké Ball" → "pokeball". */
export const searchKey = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Entries whose name contains the query: names that start with it first, then A–Z. Pure, for the Reference lists. */
export function searchByName<T extends { name: string }>(list: T[], query: string): T[] {
  const q = searchKey(query);
  const hits = list
    .map((entry) => ({ entry, key: searchKey(entry.name) }))
    .filter(({ key }) => key.includes(q));
  return hits
    .sort((a, b) => Number(b.key.startsWith(q)) - Number(a.key.startsWith(q)) || a.entry.name.localeCompare(b.entry.name))
    .map(({ entry }) => entry);
}
