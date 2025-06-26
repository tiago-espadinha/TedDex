import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ART_STYLE_EXAMPLE, FORM_KIND_EXAMPLES, FORM_KIND_LABELS } from '../src/data/dexState';
import type { IndexEntry } from '../src/data/types';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

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
const blocks = {
  'A light': ':root {',
  'A dark (system)': ":root:not([data-theme='light']) {",
  'A dark (chosen)': ":root[data-theme='dark'] {",
  B: ":root[data-design='b'] {",
};
const tokensOf = (selector: string) => {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf('}', start));
  return (name: string) => {
    const value = block.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1];
    assert.ok(value, `--${name} in ${selector}`);
    return value;
  };
};

/** What tells on from off, and what it sits against. */
const STATE_PAIRS = [
  ['muted', 'surface', 'off tile tick ring'],
  ['primary', 'primary-soft', 'on tile border and tick'],
  ['primary-ink', 'primary', 'on tile tick mark'],
  ['primary', 'bg', 'pill ring on the page'],
  ['primary', 'primary-soft', 'pill ring on its fill'],
];

for (const [design, selector] of Object.entries(blocks)) {
  test(`toggle states reach 3:1 in ${design}`, () => {
    const token = tokensOf(selector);
    for (const [a, b, what] of STATE_PAIRS) {
      assert.ok(contrast(token(a), token(b)) >= 3, `${what}: --${a} on --${b}`);
    }
  });

  test(`toggle text reaches 4.5:1 in ${design}`, () => {
    const token = tokensOf(selector);
    assert.ok(contrast(token('primary-soft-ink'), token('primary-soft')) >= 4.5, 'on label');
    assert.ok(contrast(token('ink'), token('surface')) >= 4.5, 'off tile label');
    assert.ok(contrast(token('ink-2'), token('bg')) >= 4.5, 'pill, unselected half');
  });
}

test('every form switch has an example with a sprite and artwork', () => {
  assert.deepEqual(Object.keys(FORM_KIND_EXAMPLES).sort(), Object.keys(FORM_KIND_LABELS).sort());
  for (const { id, speciesId } of Object.values(FORM_KIND_EXAMPLES)) {
    for (const dir of ['sprites', 'artwork']) {
      assert.ok(existsSync(new URL(`../public/media/${dir}/${id}.webp`, import.meta.url)), `${dir}/${id}`);
    }
    assert.ok(
      existsSync(new URL(`../public/media/sprites/${speciesId}.webp`, import.meta.url)),
      `sprites/${speciesId}`,
    );
  }
});

test('the art style example has a sprite and artwork', () => {
  for (const dir of ['sprites', 'artwork']) {
    assert.ok(
      existsSync(new URL(`../public/media/${dir}/${ART_STYLE_EXAMPLE}.webp`, import.meta.url)),
      `${dir}/${ART_STYLE_EXAMPLE}`,
    );
  }
});

test("every form switch's example is a form of that kind", () => {
  const index = JSON.parse(readFileSync(new URL('../public/data/index.json', import.meta.url), 'utf8')) as IndexEntry[];
  for (const [kind, { id, speciesId }] of Object.entries(FORM_KIND_EXAMPLES)) {
    const form = index.find((s) => s.id === speciesId)?.forms?.find((f) => f.pokemonId === id);
    assert.equal(form?.kind, kind, `${kind}: form ${id} of species ${speciesId}`);
  }
});
