import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { favouriteKey } from './filter';

/** The favourites as favouriteKey strings, kept live; undefined while loading. */
export function useFavourites(): ReadonlySet<string> | undefined {
  return useLiveQuery(async () => new Set((await db.favourites.toArray()).map((f) => favouriteKey(f.speciesId, f.formKey))), []);
}

/** Whether a species in form `formKey` ('' or absent for the default) is a favourite, kept live; undefined while loading. */
export function useIsFavourite(speciesId: number, formKey = ''): boolean | undefined {
  return useLiveQuery(() => db.favourites.get([speciesId, formKey]).then(Boolean), [speciesId, formKey]);
}
