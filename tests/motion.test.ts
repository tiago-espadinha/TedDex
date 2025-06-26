import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

/** The one-shot and sliding animations of the micro-interactions: quick, and cheap to run on a phone. */
const ONE_SHOT = ['pop-in', 'pop', 'bump', 'bolt-on', 'bolt-off', 'lid-open', 'sparkle', 'nav-bounce', 'seg-slide', 'rise-in', 'sink-out', 'dialog-in', 'dialog-out'];
const COMPOSITED = new Set(['transform', 'translate', 'scale', 'rotate', 'opacity']);

function keyframes(name: string): string {
  const start = css.indexOf(`@keyframes ${name} {`);
  assert.notEqual(start, -1, `@keyframes ${name} is missing`);
  const open = css.indexOf('{', start);
  let depth = 1;
  let i = open + 1;
  while (depth > 0) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(open + 1, i - 1);
}

for (const name of ONE_SHOT) {
  test(`${name} animates transform and opacity only`, () => {
    const props = [...keyframes(name).matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    assert.ok(props.length > 0);
    for (const prop of props) assert.ok(COMPOSITED.has(prop), `${name} animates ${prop}`);
  });

  test(`${name} runs for 250 ms or less wherever it is used`, () => {
    const uses = [...css.matchAll(new RegExp(`animation:\\s*${name}\\s+(\\d+)ms`, 'g'))];
    assert.ok(uses.length > 0, `${name} is never used`);
    for (const use of uses) assert.ok(Number(use[1]) <= 250, `${name} runs ${use[1]} ms`);
  });
}

test('playAnim keeps its attribute on longer than any one-shot runs', () => {
  const bits = readFileSync(new URL('../src/components/bits.tsx', import.meta.url), 'utf8');
  const kept = Number(bits.match(/const PLAY_MS = (\d+);/)?.[1]);
  const rules = css.split('\n').filter((line) => line.startsWith('[data-play') || line.includes('[data-play='));
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    const ms = Number(rule.match(/animation: [a-z-]+ (\d+)ms/)?.[1]);
    assert.ok(ms < kept, rule);
  }
});

test('the sliding nav pill and the view toggle stay under 250 ms', () => {
  for (const selector of ['.nav-ink {', '.view-toggle :is(.inner, .bridge) {']) {
    const rule = css.split('\n').find((line) => line.startsWith(selector)) ?? '';
    const durations = [...rule.matchAll(/transition:[^;]*/g)].flatMap((m) => [...m[0].matchAll(/(\d+)ms/g)].map((d) => Number(d[1])));
    assert.ok(durations.length > 0, selector);
    for (const ms of durations) assert.ok(ms <= 250, `${selector} ${ms} ms`);
  }
});

test('the nav and what moves with it slide by transform or translate, under 250 ms', () => {
  for (const [selector, prop] of [['.bottom-nav {', 'transform'], [':is(.fab, .to-top, .toast) {', 'translate']]) {
    const rule = css.split('\n').find((line) => line.startsWith(selector) && line.includes('transition:')) ?? '';
    const match = rule.match(/transition: ([a-z-]+) (\d+)ms/);
    assert.equal(match?.[1], prop, selector);
    assert.ok(Number(match?.[2]) <= 250, selector);
  }
});

test('the toast is centred by translate, so the rise keyframes can set transform', () => {
  const toast = css.match(/\.toast \{[^}]*\}/)?.[0] ?? '';
  assert.match(toast, /translate: -50% 0/);
  assert.doesNotMatch(toast, /transform:/);
});
