import { searchByName, searchKey } from './reference';

/** A parsed search: `!` binds tighter than `&`, `&` tighter than `|`. A space is part of a term ("thunder punch"). */
export type QueryNode =
  | { kind: 'term'; term: string }
  | { kind: 'not'; node: QueryNode }
  | { kind: 'and' | 'or'; nodes: QueryNode[] };

/** Longer than any name; ?q= comes from the URL and the parser recurses per "(". */
const MAX_QUERY_LENGTH = 200;

/**
 * Never throws: an empty operand is ignored ("grass &" = grass), an unclosed "(" closes at the end, text after a group
 * with no operator is dropped, and null means nothing to search for. "(" opens a group only where an operand starts,
 * so "Poké Ball (Let's Go)" stays one term.
 */
export function parseQuery(query: string): QueryNode | null {
  const text = query.slice(0, MAX_QUERY_LENGTH).toLowerCase();
  let at = 0;
  let depth = 0;

  const list = (kind: 'and' | 'or', separator: string, operand: () => QueryNode | null): QueryNode | null => {
    const nodes: QueryNode[] = [];
    do {
      if (text[at] === separator) at++;
      const node = operand();
      if (node) nodes.push(node);
    } while (text[at] === separator);
    return nodes.length > 1 ? { kind, nodes } : (nodes[0] ?? null);
  };
  const or = () => list('or', '|', and);
  const and = () => list('and', '&', not);

  const not = (): QueryNode | null => {
    while (text[at] === ' ') at++;
    if (text[at] === '!') {
      at++;
      const node = not();
      return node && { kind: 'not', node };
    }
    if (text[at] !== '(') return term();
    at++;
    depth++;
    const node = or();
    depth--;
    if (text[at] === ')') at++;
    while (text[at] === ' ') at++;
    return node;
  };

  const term = (): QueryNode | null => {
    let out = '';
    let open = 0;
    for (; at < text.length; at++) {
      const c = text[at];
      if (c === '&' || c === '|') break;
      if (c === '(') open++;
      if (c === ')') {
        if (open) open--;
        else if (depth) break;
        else continue;
      }
      // No name has a "!": dropping it keeps "char!" on Charmander while it's typed.
      if (c !== '!') out += c;
    }
    out = out.trim();
    // Punctuation alone ("fire & #" on its way to "#25") is an empty operand, not a search; the signs are in Nidoran's names.
    return /[\p{L}\p{N}♀♂]/u.test(out) ? { kind: 'term', term: out } : null;
  };

  return or();
}

/**
 * The test for each item of a parsed query; `resolve` runs once per term, so a term's search isn't repeated per item.
 * `negated` tells it the term's test will be inverted (an odd number of "!" above it), for words that mean less when negated.
 */
export function compileQuery<T>(
  node: QueryNode,
  resolve: (term: string, negated: boolean) => (item: T) => boolean,
  negated = false,
): (item: T) => boolean {
  if (node.kind === 'term') return resolve(node.term, negated);
  if (node.kind === 'not') {
    const test = compileQuery(node.node, resolve, !negated);
    return (item) => !test(item);
  }
  const tests = node.nodes.map((n) => compileQuery(n, resolve, negated));
  return node.kind === 'and' ? (item) => tests.every((t) => t(item)) : (item) => tests.some((t) => t(item));
}

const nameTest = (term: string) => {
  const key = searchKey(term);
  return (entry: { name: string }) => searchKey(entry.name).includes(key);
};

/**
 * The search of the Moves and Items lists. A lone name ranks as searchByName does; a lone keyword also lists the names
 * holding the word, so "rock" keeps Rock Climb. With operators a keyword is exact. Anything but a lone name lists A to Z.
 */
export function searchEntries<T extends { name: string }>(
  entries: T[],
  query: string,
  keyword: (term: string) => ((entry: T) => boolean) | undefined,
): T[] {
  const node = parseQuery(query);
  if (!node) return searchByName(entries, '');
  if (node.kind === 'term') {
    const inKeyword = keyword(node.term);
    if (!inKeyword) return searchByName(entries, node.term);
    const inName = nameTest(node.term);
    return searchByName(
      entries.filter((e) => inKeyword(e) || inName(e)),
      '',
    );
  }
  return searchByName(entries.filter(compileQuery<T>(node, (term) => keyword(term) ?? nameTest(term))), '');
}
