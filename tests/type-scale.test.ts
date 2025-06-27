import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { css } from './helpers/css';

const MIN = 12;
/** Sizes from here up are headings, which keep their own values. */
const HEADING = 17;

test('the type scale tokens are never under the minimum', () => {
  const tokens = [...css.matchAll(/--fs-[a-z]+:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
  assert.ok(tokens.length >= 5);
  for (const size of tokens) assert.ok(size >= MIN, `token of ${size}px`);
});

test('body and table text sizes come from the scale', () => {
  for (const [rule, value] of css.matchAll(/font-size:\s*([^;}]+)/g)) {
    if (/^var\(--fs-[a-z]+\)$/.test(value.trim())) continue;
    const sizes = [...value.matchAll(/([\d.]+)px/g)].map((m) => Number(m[1]));
    assert.ok(sizes.length > 0 && sizes.every((size) => size >= HEADING), rule);
  }
});

test('components set no font size of their own', () => {
  const dir = new URL('../src/', import.meta.url);
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f));
  for (const f of files) {
    const source = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(source, /fontSize\s*[:=](?!\s*'var\(--fs-)/, f);
  }
});
