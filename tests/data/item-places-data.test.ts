import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { ItemPlaces, ItemReferenceTable } from '../../src/data/types';
import { dataEntry } from '../helpers/data-files';

// The committed output of `npm run item-places`.
const read = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(`../../public/data/reference/${path}`, import.meta.url), 'utf8')) as T;

describe('item places data', () => {
  const items = read<ItemReferenceTable>('items.json');
  const places = new Map(
    Object.keys(items).map((id) => [items[Number(id)].name, dataEntry<ItemPlaces>('reference/places', Number(id))]),
  );

  test('Leftovers: held by wild Snorlax and found in places that are not wild Pokémon', () => {
    const leftovers = places.get('Leftovers')!;
    assert.ok(leftovers.games.some((g) => g.held?.some(([species]) => species === 143)));
    assert.ok(
      leftovers.games.some(
        (g) => g.game === 'Scarlet / Violet' && g.repeat?.includes('Delibird Presents (Cascarrafa Branch)'),
      ),
    );
  });

  test('every item with Bulbapedia text credits its page', () => {
    for (const [name, p] of places) {
      const fromWiki = p.games.some((g) => g.once || g.repeat || g.note);
      assert.equal(!!p.source, fromWiki, name);
      if (p.source) assert.match(p.source, /^https:\/\/bulbapedia\.bulbagarden\.net\/wiki\//, name);
    }
  });

  test('no group is empty and wild chances are percentages', () => {
    for (const [name, p] of places) {
      for (const g of p.games) {
        assert.ok(g.game && (g.held || g.once || g.repeat || g.note), `${name}: ${g.game}`);
        for (const [, rarity] of g.held ?? []) assert.ok(rarity > 0 && rarity <= 100, `${name}: ${rarity}`);
      }
    }
  });

  test('a game is named once even when Bulbapedia gives both Gen I codes', () => {
    for (const [name, p] of places) {
      for (const g of p.games) {
        const parts = g.game.split(' / ');
        assert.equal(new Set(parts).size, parts.length, `${name}: ${g.game}`);
      }
    }
  });

  test('a game-specific copy lists only its game; the Poké Ball page is "Poké Ball (item)"', () => {
    assert.deepEqual(
      places.get('Fishing Rod (Sword/Shield)')!.games.map((g) => g.game),
      ['Sword / Shield'],
    );
    assert.ok(places.get('Fishing Rod')!.games.length > 1);
    assert.equal(places.get('Poké Ball')!.games[0].game, 'Legends: Z-A');
  });
});
