import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const bits = readFileSync(new URL('../../src/components/Spinner/Spinner.tsx', import.meta.url), 'utf8');

/** The spinner's SVG, attributes in JSX spelling, whitespace collapsed. */
const svg = (source: string) =>
  source
    .match(/<svg class(?:Name)?="spinner"[\s\S]*?<\/svg>/)?.[0]
    .replace(/className=/g, 'class=')
    .replace(/\s+/g, ' ');

test('the boot screen repeats the Spinner markup', () => {
  assert.ok(svg(html));
  assert.equal(svg(html), svg(bits));
});

test('the boot spinner is inside the React root, so mounting replaces it', () => {
  const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('</body>'));
  assert.match(root, /class="loading boot" role="status"/);
});

test('no external stylesheet blocks the first paint', () => {
  const head = html.slice(0, html.indexOf('</head>')).replace(/<noscript\s*>[\s\S]*?<\/noscript>/g, '');
  for (const [link] of head.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)) {
    if (/href="https?:/.test(link)) assert.match(link, /media="print"\s+onload="this\.media\s*=\s*'all'"/, link);
  }
});

test('the stored theme and design apply before the stylesheets', () => {
  const script = html.indexOf("localStorage.getItem('theme')");
  assert.ok(script > 0 && script < html.indexOf('rel="stylesheet"'));
  assert.match(html, /getItem\('design'\) === 'b'/);
});
