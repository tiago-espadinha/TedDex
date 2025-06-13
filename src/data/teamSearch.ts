import { searchKey } from './reference';

/** Whether a team's name or any of its members' names (species or form names and nicknames) contains the query; an empty query matches every team. */
export function teamMatches(name: string, memberNames: string[], query: string): boolean {
  const q = searchKey(query);
  return !q || [name, ...memberNames].some((n) => searchKey(n).includes(q));
}
