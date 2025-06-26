import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextNavScroll } from '../src/data/navHide';

const shown = (y: number) => ({ y, away: false });
const away = (y: number) => ({ y, away: true });

test('scrolling down hides the nav, scrolling up brings it back', () => {
  assert.deepEqual(nextNavScroll(shown(100), 120), away(120));
  assert.deepEqual(nextNavScroll(away(500), 480), shown(480));
});

test('the top always shows the nav, however little the last scroll and past it on a bounce', () => {
  assert.deepEqual(nextNavScroll(away(3), 0), shown(0));
  assert.deepEqual(nextNavScroll(away(3), -40), shown(0));
});

test('jitter changes nothing, but slow scrolling adds up', () => {
  assert.deepEqual(nextNavScroll(shown(100), 105), shown(100));
  assert.deepEqual(nextNavScroll(away(100), 95), away(100));
  assert.deepEqual(nextNavScroll(shown(100), 108), away(108));
});
