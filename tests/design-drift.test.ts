import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-design-drift.sh', import.meta.url));
const dirs: string[] = [];
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A throwaway repo: the script under scripts/, a design doc and the given source files. */
function repo(header: string, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'drift-'));
  dirs.push(root);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'docs'));
  copyFileSync(script, join(root, 'scripts/check-design-drift.sh'));
  writeFileSync(join(root, 'docs/DESIGN_DIRECTION.md'), `# Direction\n\n${header}\n`);
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

/** Runs the script as `bash <scriptPath> ...args` from `cwd`, with CDPATH set as in some user shells. */
function run(root: string, cwd = root, args: string[] = [], scriptPath = join(root, 'scripts/check-design-drift.sh')) {
  const env = { ...process.env, CDPATH: '.' };
  const r = spawnSync('bash', [scriptPath, ...args], { cwd, env, encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
}

const clean = {
  'src/styles.css': ':root { --bg: #fff; }\n',
  'src/app.ts': 'export const a = "var(--bg)";\n',
};

test('gives the same result from any directory', () => {
  const root = repo('Tokens file: src/styles.css', { ...clean, 'src/bad.ts': 'const c = "#ff0000";\n' });
  const fromRoot = run(root);
  assert.equal(fromRoot.code, 1);
  assert.match(fromRoot.out, /^src\/bad\.ts:1:/m);
  assert.deepEqual(run(root, join(root, 'src')), fromRoot);
  assert.deepEqual(run(root, join(root, 'src'), ['.']), fromRoot);
  assert.deepEqual(run(root, root, ['./src']), fromRoot);
  assert.deepEqual(run(root, root, [], 'scripts/check-design-drift.sh'), fromRoot);
  assert.deepEqual(run(root, join(root, 'src'), [], '../scripts/check-design-drift.sh'), fromRoot);
});

test('fails instead of skipping when the given source dir does not exist', () => {
  const r = run(repo('Tokens file: src/styles.css', clean), undefined, ['scr']);
  assert.equal(r.code, 2);
  assert.equal(r.out, '');
});

test('passes a clean tree with "none" or an empty allowed list', () => {
  for (const allowed of ['Allowed color files: none', 'Allowed color files:', '']) {
    const r = run(repo(`Tokens file: src/styles.css\n${allowed}`, clean));
    assert.equal(r.code, 0, allowed);
    assert.match(r.out, /^PASS/);
  }
});

test('exempts only the exact tokens file, not others with the same name', () => {
  const root = repo('Tokens file: src/styles.css', { ...clean, 'src/widget/styles.css': 'a { color: #123456; }\n' });
  const r = run(root);
  assert.equal(r.code, 1);
  assert.match(r.out, /^src\/widget\/styles\.css:1:/m);
  assert.doesNotMatch(r.out, /^src\/styles\.css:/m);
});

test('exempts allowed files, including paths with spaces and a leading ./', () => {
  const header = 'Tokens file: src/styles.css\nAllowed color files: ./src/my palette.ts , src/b.ts';
  const files = { ...clean, 'src/my palette.ts': 'export const p = "#abcdef";\n', 'src/b.ts': 'const b = "rgb(1, 2, 3)";\n' };
  const root = repo(header, files);
  for (const r of [run(root), run(root, root, ['./src'])]) {
    assert.equal(r.code, 0);
    assert.match(r.out, /^PASS/);
  }
});
