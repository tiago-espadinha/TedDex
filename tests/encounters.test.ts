import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { summariseSlots, type ConditionValue, type SlotRow } from '../scripts/encounters';

// Ids and names as in encounter_condition_values.csv.
const VALUES = new Map<string, ConditionValue>([
  ['1', { type: '1', name: 'During a swarm' }],
  ['2', { type: '1', name: 'Not during a swarm' }],
  ['3', { type: '2', name: 'In the morning' }],
  ['4', { type: '2', name: 'During the day' }],
  ['5', { type: '2', name: 'At night' }],
  ['6', { type: '3', name: 'Using PokéRadar' }],
  ['7', { type: '3', name: 'Not using PokéRadar' }],
  ['8', { type: '4', name: 'No game in slot 2' }],
  ['9', { type: '4', name: 'Ruby in slot 2' }],
  ['14', { type: '5', name: 'Radio off' }],
  ['15', { type: '5', name: 'Hoenn radio' }],
]);
const ALL = new Set(VALUES.keys());
let nextSlot = 0;
const slot = (rarity: number, conditions: string[], min = 2, max = min, id = String(++nextSlot)): SlotRow => ({
  slot: id,
  min,
  max,
  rarity,
  conditions,
});

describe('summariseSlots', () => {
  test('sums slots per time of day and notes the times it appears', () => {
    // Pidgey on Route 1 in Gold: four slots, each listed once for the morning and once for the day.
    const slots = [30, 10, 4, 1].flatMap((r, i) => [slot(r, ['3'], 2, 2, `s${i}`), slot(r, ['4'], 2, 2, `s${i}`)]);
    assert.deepEqual(summariseSlots(slots, VALUES, ALL), {
      min: 2,
      max: 2,
      rate: 45,
      note: 'In the morning, During the day',
    });
  });

  test('leaves out a condition the Pokémon appears under in every case', () => {
    const slots = [slot(20, ['3']), slot(20, ['4']), slot(20, ['5'])];
    assert.deepEqual(summariseSlots(slots, VALUES, ALL), { min: 2, max: 2, rate: 20 });
  });

  test('leaves out a condition when a slot ignores it', () => {
    // Route 35 in Gold: one slot, by day and morning outside swarms and at any time in a swarm.
    const slots = [slot(5, ['2', '4'], 2, 2, 's'), slot(5, ['2', '3'], 2, 2, 's'), slot(5, ['1'], 2, 2, 's')];
    assert.deepEqual(summariseSlots(slots, VALUES, ALL), { min: 2, max: 2, rate: 5 });
  });

  test('adds slots that need no condition to the ones that do', () => {
    // Pidgey on Route 29 in HeartGold: three slots only with the radio off, three at any radio setting.
    const slots = [
      ...[20, 4, 1].flatMap((r, i) => [slot(r, ['3'], 2, 2, `a${i}`), slot(r, ['4'], 2, 2, `a${i}`)]),
      ...[10, 10, 10].flatMap((r, i) => [slot(r, ['14', '3'], 2, 2, `b${i}`), slot(r, ['14', '4'], 2, 2, `b${i}`)]),
    ];
    const s = summariseSlots(slots, VALUES, ALL);
    assert.equal(s.rate, 55);
    assert.equal(s.upTo, true);
    assert.equal(s.note, 'In the morning, During the day');
  });

  test('counts each combination of swarm, time, radar and slot 2', () => {
    // Bidoof on Route 201 in Diamond: 50% in a normal day, 60% at night.
    const slots = [slot(20, ['2']), slot(10, ['5']), slot(10, []), slot(5, []), slot(10, ['7']), slot(1, ['7']), slot(4, ['8'])];
    assert.deepEqual(summariseSlots(slots, VALUES, ALL), { min: 2, max: 2, rate: 60, upTo: true });
  });

  test('notes a swarm-only encounter', () => {
    assert.equal(summariseSlots([slot(40, ['1'])], VALUES, ALL).note, 'During a swarm');
  });

  test('only counts the values used in that area', () => {
    // An area with no night slots: appearing in the morning and during the day is no limit.
    const slots = [slot(10, ['3']), slot(10, ['4'])];
    assert.equal(summariseSlots(slots, VALUES, new Set(['3', '4'])).note, undefined);
  });

  test('gives the best rate and flags it when the rate depends on conditions', () => {
    const slots = [slot(10, ['3']), slot(20, ['4']), slot(30, ['5'])];
    const s = summariseSlots(slots, VALUES, ALL);
    assert.equal(s.rate, 30);
    assert.equal(s.upTo, true);
  });

  test('merges level ranges and caps the rate at 100', () => {
    const s = summariseSlots([slot(60, [], 3, 5), slot(60, [], 7, 9)], VALUES, ALL);
    assert.deepEqual(s, { min: 3, max: 9, rate: 100 });
  });
});
