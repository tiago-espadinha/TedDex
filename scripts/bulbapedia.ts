/** The raw page fetch the Bulbapedia builds share. Through curl: Bulbapedia challenges Node's fetch. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const WIKI = 'https://bulbapedia.bulbagarden.net';
export const USER_AGENT = 'material-dex-web data build (non-commercial fan project)';

const run = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A page's raw wikitext, one page per second; any status but 200 throws, unless `missingOk` reads a 404 as "". */
export async function fetchPage(page: string, { missingOk = false } = {}): Promise<string> {
  console.log(`  fetching ${page}`);
  const url = `${WIKI}/w/index.php?title=${encodeURIComponent(page)}&action=raw`;
  const { stdout } = await run('curl', ['-sS', '-A', USER_AGENT, '-w', '\n%{http_code}', url], { maxBuffer: 1 << 26 });
  const cut = stdout.lastIndexOf('\n');
  const status = Number(stdout.slice(cut + 1));
  if (status !== 200 && !(missingOk && status === 404)) throw new Error(`${page}: HTTP ${status}`);
  await sleep(1000); // be polite to the wiki
  return status === 200 ? stdout.slice(0, cut) : '';
}
