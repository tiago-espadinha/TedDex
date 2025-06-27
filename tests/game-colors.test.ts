import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GAME_SLUGS, gameBand, gameColors, gameSlug } from '../src/data/gameColors';
import type { Game, ItemPlaces, VersionGroup } from '../src/data/types';
import { readData } from './data-files';
import { css } from './helpers/css';

const blockAfter = (selector: string) => {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf('}', start));
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

test('every game has a token in :root and Design B, white text passes 4.5:1, Design A dark keeps the light ones', () => {
  for (const [name, block] of Object.entries({
    'Design A': blockAfter(':root {'),
    'Design B': blockAfter(":root[data-design='b'] {"),
  })) {
    for (const slug of GAME_SLUGS) {
      const hex = block.match(new RegExp(`--game-${slug}: (#[0-9a-f]{6});`))?.[1];
      assert.ok(hex, `${name}: --game-${slug}`);
      const ratio = contrastOnWhite(hex);
      assert.ok(ratio >= 4.5, `${name}: ${slug} ${hex} is ${ratio.toFixed(2)}:1`);
    }
  }
  for (const selector of [":root:not([data-theme='light']) {", ":root[data-theme='dark'] {"])
    assert.doesNotMatch(blockAfter(selector), /--game-/, selector);
});

test('slugs drop accents, apostrophes and punctuation', () => {
  assert.equal(gameSlug('Let’s Go, Pikachu!'), 'lets-go-pikachu');
  assert.equal(gameSlug("Let's Go, Eevee!"), 'lets-go-eevee');
  assert.equal(gameSlug('Pokéwalker'), 'pokewalker');
  assert.equal(gameSlug('XD: Gale of Darkness'), 'xd-gale-of-darkness');
  assert.equal(gameSlug('Black 2'), 'black-2');
});

test('a single game is its colour; several make a gradient in order, DLC left out', () => {
  assert.equal(gameBand('Yellow'), 'var(--game-yellow)');
  assert.equal(gameBand('Red / Blue'), 'linear-gradient(var(--game-red), var(--game-blue))');
  assert.deepEqual(gameColors('Sword / Shield / The Crown Tundra'), ['var(--game-sword)', 'var(--game-shield)']);
  assert.deepEqual(gameColors('Scarlet / The Indigo Disk'), ['var(--game-scarlet)']);
  assert.deepEqual(gameColors('Other'), ['var(--game-other)']);
  assert.deepEqual(gameColors('Some new spin-off'), ['var(--game-other)']);
});

/** Every game a label names is known, so none falls back to grey by mistake. */
function assertKnown(label: string) {
  const named = gameColors(label);
  assert.ok(label === 'Other' || !named.includes('var(--game-other)'), `${label} has no colour`);
}

test('every version, version group and league game has its colours', () => {
  for (const g of readData<Game[]>('games.json')) assertKnown(g.label);
  for (const v of readData<VersionGroup[]>('versions.json')) assertKnown(v.label);
  for (const kind of ['league', 'gyms'])
    for (const g of readData<{ label: string }[]>(`${kind}/index.json`)) assertKnown(g.label);
});

test('every item place game has its colours', () => {
  const dir = new URL('../public/data/reference/places/', import.meta.url);
  const labels = new Set<string>();
  for (const file of readdirSync(dir)) {
    const chunk = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Record<string, ItemPlaces>;
    for (const places of Object.values(chunk)) for (const g of places.games) labels.add(g.game);
  }
  assert.ok(labels.size > 50);
  for (const label of labels) assertKnown(label);
});
