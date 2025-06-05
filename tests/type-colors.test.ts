import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TYPE_NAMES } from '../src/data/typeColors';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const contrastOnWhite = (hex: string) => contrast(hex, '#ffffff');
const blockAfter = (selector: string) => {
  const start = css.indexOf(selector);
  return css.slice(start, css.indexOf('}', start));
};
const token = (block: string, name: string) => block.match(new RegExp(`${name}: (#[0-9a-f]{6});`))?.[1];
const darkBlocks = {
  'prefers-color-scheme': blockAfter(":root:not([data-theme='light']) {"),
  "data-theme='dark'": blockAfter(":root[data-theme='dark'] {"),
};

test('every type has a chip and a tint token in :root', () => {
  for (const t of TYPE_NAMES) {
    assert.match(rootBlock, new RegExp(`--type-${t}-chip: #[0-9a-f]{6};`), t);
    assert.match(rootBlock, new RegExp(`--type-${t}-tint: #[0-9a-f]{6};`), t);
  }
});

test('chip text stays white in every design', () => {
  for (const [, value] of css.matchAll(/--on-type: ([^;]+);/g)) assert.equal(value, '#ffffff');
});

test('white chip text passes 4.5:1 on every chip, in every design', () => {
  const chips = [...css.matchAll(/--type-([a-z]+)-chip: (#[0-9a-f]{6});/g)];
  assert.ok(chips.length >= TYPE_NAMES.length);
  for (const [, type, hex] of chips) {
    const ratio = contrastOnWhite(hex);
    assert.ok(ratio >= 4.5, `${type} ${hex} is ${ratio.toFixed(2)}:1`);
  }
});

test('every move category has a badge token in :root, and its white glyph passes 4.5:1 in every design', () => {
  for (const c of ['physical', 'special', 'status']) assert.match(rootBlock, new RegExp(`--cat-${c}: #[0-9a-f]{6};`), c);
  assert.match(rootBlock, /--on-cat: #ffffff;/);
  const badges = [...css.matchAll(/--cat-([a-z]+): (#[0-9a-f]{6});/g)];
  assert.ok(badges.length >= 6);
  for (const [, category, hex] of badges) {
    const ratio = contrastOnWhite(hex);
    assert.ok(ratio >= 4.5, `${category} ${hex} is ${ratio.toFixed(2)}:1`);
  }
});

const TINT_INKS = ['--on-tint', '--on-tint-2', '--on-tint-muted', '--on-tint-soft'];

test('tint text passes 4.5:1 on every tint, light and dark', () => {
  for (const [name, block] of Object.entries({ light: rootBlock, ...darkBlocks })) {
    const inks = TINT_INKS.map((ink) => [ink, token(block, ink)]);
    for (const [ink, hex] of inks) assert.ok(hex, `${name}: ${ink}`);
    for (const t of TYPE_NAMES) {
      const tint = token(block, `--type-${t}-tint`);
      assert.ok(tint, `${name}: --type-${t}-tint`);
      for (const [ink, hex] of inks) {
        const ratio = contrast(hex!, tint);
        assert.ok(ratio >= 4.5, `${name}: ${ink} ${hex} on ${t} ${tint} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test('Design A dark tints are darker than the light ones, the same in both dark blocks', () => {
  for (const [name, block] of Object.entries(darkBlocks)) {
    for (const t of TYPE_NAMES) {
      const light = token(rootBlock, `--type-${t}-tint`)!;
      const dark = token(block, `--type-${t}-tint`)!;
      assert.ok(luminance(dark) < luminance(light), `${name}: ${t} ${dark} is not darker than ${light}`);
    }
  }
  const declarations = (block: string) => block.match(/--[a-z0-9-]+: [^;]+;/g);
  assert.deepEqual(
    declarations(darkBlocks['prefers-color-scheme']),
    declarations(darkBlocks["data-theme='dark'"]),
    'both Design A dark blocks set the same tokens',
  );
});
