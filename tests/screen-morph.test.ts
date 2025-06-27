import assert from 'node:assert/strict';
import { test } from 'node:test';
import { screenDirection } from '../src/data/screenMorph';
import { css } from './helpers/css';

const at = (pathname: string, picking = false) => ({ pathname, picking });

test('switching between tabs is a tab change, whichever way', () => {
  assert.equal(screenDirection(at('/'), at('/more')), 'tab');
  assert.equal(screenDirection(at('/teams'), at('/teams/pokedex')), 'tab');
  assert.equal(screenDirection(at('/reference'), at('/'), -1), 'tab');
});

test('opening a page goes forward, a Back link to its parent goes back', () => {
  assert.equal(screenDirection(at('/teams'), at('/teams/5')), 'forward');
  assert.equal(screenDirection(at('/teams/5'), at('/teams')), 'back');
  assert.equal(screenDirection(at('/teams/pokedex/7'), at('/teams/pokedex')), 'back');
  assert.equal(screenDirection(at('/reference/moves'), at('/reference')), 'back');
  assert.equal(screenDirection(at('/teams/pokedex/7'), at('/teams')), 'back');
});

test('a nav tab tapped on a page with the nav is a tab change', () => {
  assert.equal(screenDirection(at('/teams/5'), at('/')), 'tab');
  assert.equal(screenDirection(at('/teams/5'), at('/reference')), 'tab');
});

test('a path that only starts the same is no parent', () => {
  assert.equal(screenDirection(at('/teams/50'), at('/teams/5')), 'forward');
});

test('the history step decides for Back and Forward', () => {
  assert.equal(screenDirection(at('/reference/moves/3'), at('/pokemon/5'), -1), 'back');
  assert.equal(screenDirection(at('/teams'), at('/teams/5'), -2), 'back');
  assert.equal(screenDirection(at('/teams/5'), at('/teams'), 1), 'forward');
});

test('pick mode is a pushed screen, not the Dex tab', () => {
  assert.equal(screenDirection(at('/teams/5'), at('/', true)), 'forward');
  assert.equal(screenDirection(at('/teams'), at('/', true)), 'forward');
  assert.equal(screenDirection(at('/', true), at('/teams/5'), -1), 'back');
});

test('morphs stay within the screen-change limit and off under reduced motion', () => {
  const rules = [...css.matchAll(/^::view-transition-[a-z]+\(morph-[a-z]+\)[^{]*\{[^}]*\}/gm)].map((m) => m[0]);
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    const ms = Number(rule.match(/animation-duration: (\d+)ms/)?.[1]);
    assert.ok(ms > 0 && ms <= 250, rule);
  }
  assert.match(
    css,
    /prefers-reduced-motion: reduce\)[^@]*::view-transition-group\(\*\)[^{]*\{\s*animation: none !important/,
  );
});
