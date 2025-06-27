import { readdirSync, readFileSync } from 'node:fs';

const SRC = new URL('../../src/', import.meta.url);

export const INDEX = 'styles/index.css';

/** Every stylesheet under `src/`, as paths from there. */
export const cssFiles = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.css'))
  .sort();

export const readSource = (file: string) => readFileSync(new URL(file, SRC), 'utf8');

export const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** The layer names of each `@layer a, b;` statement in a stylesheet, comments ignored. */
export const layerStatements = (text: string) =>
  [...stripComments(text).matchAll(/@layer\s+([^{};]+);/g)].map((m) => m[1].split(',').map((name) => name.trim()));

function commentEnd(text: string, start: number) {
  const end = text.indexOf('*/', start);
  if (end < 0) throw new Error('unterminated comment');
  return end + 2;
}

/**
 * Splits a stylesheet into its top-level `@layer name { ... }` blocks (comments inside kept) and whatever else
 * sits outside them, comments aside: nothing, in a layered file.
 */
export function layerBlocks(text: string) {
  const blocks: { name: string; body: string }[] = [];
  let outside = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('/*', i)) {
      i = commentEnd(text, i);
      continue;
    }
    const head = /^@layer\s+([\w-]+)\s*\{/.exec(text.slice(i));
    if (!head) {
      outside += text[i++];
      continue;
    }
    const start = i + head[0].length;
    let depth = 1;
    let end = start;
    while (depth > 0 && end < text.length) {
      if (text.startsWith('/*', end)) {
        end = commentEnd(text, end);
        continue;
      }
      if (text[end] === '{') depth++;
      if (text[end] === '}') depth--;
      end++;
    }
    blocks.push({ name: head[1], body: text.slice(start, end - 1) });
    i = end;
  }
  return { blocks, outside: outside.trim() };
}

/** The layers in cascade order, as `src/styles/index.css` declares them. */
export const LAYER_ORDER = layerStatements(readSource(INDEX))[0];

const dedent = (body: string) => body.replace(/^ {2}/gm, '');

const blocks = cssFiles.filter((file) => file !== INDEX).flatMap((file) => layerBlocks(readSource(file)).blocks);

/** All rules by layer, then by path, with the layer wrappers gone, for the tests that read the design's values. */
export const css = LAYER_ORDER.flatMap((layer) =>
  blocks.filter((block) => block.name === layer).map((block) => dedent(block.body)),
).join('\n');
