import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

const DATA = new URL('../../src/data/', import.meta.url);

/** Also what makes `npm run test:coverage` count a module no test imports: Node reports only what was loaded. */
test('every data module loads', async () => {
  // settings.ts follows the OS colour scheme as it loads; Node has no matchMedia.
  globalThis.matchMedia = (() => ({ addEventListener() {} })) as unknown as typeof matchMedia;
  const modules = readdirSync(DATA).filter((file) => file.endsWith('.ts'));
  assert.ok(modules.length > 0);
  for (const file of modules) await import(new URL(file, DATA).href);
});
