import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  css,
  cssFiles,
  INDEX,
  LAYER_ORDER,
  layerBlocks,
  layerStatements,
  readSource,
  stripComments,
} from '../helpers/css';

const SRC = new URL('../../src/', import.meta.url);
const layered = cssFiles.filter((file) => file !== INDEX);

const imports = () => {
  const found: string[] = [];
  for (const m of readSource(INDEX).matchAll(/@import '([^']+)';/g)) found.push(join(dirname(INDEX), m[1]));
  const code = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file));
  for (const file of code) {
    const source = readSource(file);
    for (const m of source.matchAll(/^import '(\.[^']+\.css)';$/gm)) found.push(join(dirname(file), m[1]));
  }
  return found.filter((file) => file !== INDEX);
};

test('the layer order is declared once, in the index', () => {
  assert.deepEqual(LAYER_ORDER, ['tokens', 'base', 'primitives', 'components', 'screens', 'design-b', 'overrides']);
  assert.equal(layerStatements(readSource(INDEX)).length, 1);
  assert.match(
    stripComments(readSource(INDEX)),
    /^\s*@layer [^;]+;\s*@import/,
    'the order must come before the imports',
  );
  for (const file of layered) assert.deepEqual(layerStatements(readSource(file)), [], file);
});

test('the index holds nothing but the order and imports', () => {
  const rest = readSource(INDEX)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@layer[^;]+;/, '')
    .replace(/@import '[^']+';/g, '');
  assert.equal(rest.trim(), '');
});

test('the index loads before anything else, so the first CSS the browser sees sets the order', () => {
  const main = readSource('main.tsx');
  assert.match(main, /^import '\.\/styles\/index\.css';/);
});

test('every rule sits in a declared layer', () => {
  for (const file of layered) {
    const { blocks, outside } = layerBlocks(readSource(file));
    assert.equal(outside, '', `${file} has rules outside a layer`);
    assert.ok(blocks.length > 0, `${file} is empty`);
    for (const { name } of blocks) assert.ok(LAYER_ORDER.includes(name), `${file} uses the undeclared layer ${name}`);
  }
});

test('an unlayered rule is noticed, whatever its place in the file', () => {
  assert.equal(layerBlocks('.a { color: red; }\n@layer base { .b { top: 0; } }').outside, '.a { color: red; }');
  assert.equal(
    layerBlocks('@layer base { @media print { .b { top: 0; } } }\n.a { top: 0; }').outside,
    '.a { top: 0; }',
  );
  assert.equal(layerBlocks('/* note */\n@layer base { /* } */ .b { top: 0; } }').outside, '');
  assert.throws(() => layerBlocks('@layer base { /* never closed'), /unterminated/);
});

test('only the tokens file uses the tokens layer', () => {
  for (const file of layered) {
    const names = layerBlocks(readSource(file)).blocks.map((block) => block.name);
    assert.equal(names.includes('tokens'), file === 'styles/tokens.css', file);
  }
});

test('every stylesheet is imported exactly once', () => {
  const found = imports().sort();
  assert.deepEqual(found, [...new Set(found)], 'a stylesheet is imported twice');
  assert.deepEqual(found, layered);
});

test('the readers get the rules without the layer wrappers', () => {
  assert.doesNotMatch(css, /@layer/);
  assert.match(css, /^:root \{/m);
  assert.match(css, /^\[data-design='b'\] \.sheet/m);
});
