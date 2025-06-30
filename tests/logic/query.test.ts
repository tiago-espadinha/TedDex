import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { compileQuery, parseQuery } from '../../src/data/query';

const term = (t: string) => ({ kind: 'term', term: t });
const not = (node: unknown) => ({ kind: 'not', node });
const and = (...nodes: unknown[]) => ({ kind: 'and', nodes });
const or = (...nodes: unknown[]) => ({ kind: 'or', nodes });

describe('parseQuery', () => {
  test('a plain query is one trimmed, lower-cased term; a space stays in it', () => {
    assert.deepEqual(parseQuery('  Thunder Punch '), term('thunder punch'));
    assert.deepEqual(parseQuery('Mr. Mime'), term('mr. mime'));
  });

  test('precedence is ! over & over |', () => {
    assert.deepEqual(parseQuery('a | b & !c'), or(term('a'), and(term('b'), not(term('c')))));
    assert.deepEqual(parseQuery('!a & b'), and(not(term('a')), term('b')));
    assert.deepEqual(parseQuery('!!a'), not(not(term('a'))));
  });

  test('parentheses group, closing at the end if left open', () => {
    assert.deepEqual(parseQuery('(a | b) & c'), and(or(term('a'), term('b')), term('c')));
    assert.deepEqual(parseQuery('!(a & b'), not(and(term('a'), term('b'))));
  });

  test('a parenthesis inside a term is part of its name', () => {
    assert.deepEqual(parseQuery("Parcel (Let's Go)"), term("parcel (let's go)"));
    assert.deepEqual(
      parseQuery('Paldean Tauros (Combat Breed) & fire'),
      and(term('paldean tauros (combat breed)'), term('fire')),
    );
  });

  test('empty operands are ignored', () => {
    assert.deepEqual(parseQuery('grass &'), term('grass'));
    assert.deepEqual(parseQuery('& grass'), term('grass'));
    assert.deepEqual(parseQuery('a & | b'), or(term('a'), term('b')));
    assert.deepEqual(parseQuery('a | & | b'), or(term('a'), term('b')));
    assert.deepEqual(parseQuery('a & !'), term('a'));
    assert.deepEqual(parseQuery('a & ()'), term('a'));
    assert.deepEqual(parseQuery('fire & #'), term('fire'));
    assert.deepEqual(parseQuery('Nidoran♀'), term('nidoran♀'));
    assert.deepEqual(parseQuery('♀'), term('♀'));
  });

  test('nothing to search for is null, not an error', () => {
    for (const q of ['', '   ', '&', '|', '!', '!!', '(', ')', '()', '((', '))', '& | !', '!&|()', '#', '.', '!★'])
      assert.equal(parseQuery(q), null, q);
  });

  test('an operator inside a word never makes an unusable term', () => {
    assert.deepEqual(parseQuery('char!'), term('char'));
    assert.deepEqual(parseQuery('char)'), term('char'));
    assert.deepEqual(parseQuery('ch&ar'), and(term('ch'), term('ar')));
  });

  test('survives a very long query from the URL', () => {
    for (const q of ['('.repeat(100_000), '!'.repeat(100_000), 'a&'.repeat(100_000)])
      assert.doesNotThrow(() => parseQuery(q));
  });
});

describe('compileQuery', () => {
  test('resolves each term once, however many items it tests', () => {
    let resolved = 0;
    const test = compileQuery<number>(parseQuery('a & !b')!, (t) => {
      resolved++;
      return (n) => (t === 'a' ? n > 1 : n > 2);
    });
    assert.deepEqual([1, 2, 3].filter(test), [2]);
    assert.equal(resolved, 2);
  });
});
