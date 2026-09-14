import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_LETTERS, startOfWeek, localDateKey, weekIndex, bucketWeekMinutes, bucketWeekPresence, scaleBars } from '../weekly.ts';

// Wed 2026-09-16 (local). Week = Sun 13 … Sat 19.
const NOW = new Date(2026, 8, 16, 15, 30);

test('day letters are S–S', () => assert.deepEqual([...DAY_LETTERS], ['S', 'M', 'T', 'W', 'T', 'F', 'S']));

test('startOfWeek returns local midnight Sunday', () => {
  const s = startOfWeek(NOW);
  assert.equal(s.getDay(), 0);
  assert.equal(localDateKey(s), '2026-09-13');
  assert.equal(s.getHours(), 0);
  // a Sunday is its own week start
  assert.equal(localDateKey(startOfWeek(new Date(2026, 8, 13, 23, 59))), '2026-09-13');
});

test('weekIndex maps days of the current week and rejects others', () => {
  assert.equal(weekIndex(new Date(2026, 8, 13), NOW), 0);
  assert.equal(weekIndex(new Date(2026, 8, 16), NOW), 3);
  assert.equal(weekIndex(new Date(2026, 8, 19, 23, 0), NOW), 6);
  assert.equal(weekIndex(new Date(2026, 8, 20), NOW), -1);
  assert.equal(weekIndex(new Date(2026, 8, 12), NOW), -1);
});

test('bucketWeekMinutes sums per weekday, ignores other weeks and bad rows', () => {
  const rows = [
    { date: new Date(2026, 8, 14, 7).toISOString(), durationMinutes: 45 },   // Mon
    { date: new Date(2026, 8, 14, 18).toISOString(), durationMinutes: 30 },  // Mon (2nd visit)
    { date: new Date(2026, 8, 16, 9).toISOString(), durationMinutes: null }, // Wed, still active
    { date: new Date(2026, 8, 9, 9).toISOString(), durationMinutes: 60 },    // last week
    { date: 'not-a-date', durationMinutes: 60 },
    { date: new Date(2026, 8, 18, 9).toISOString(), durationMinutes: -5 },   // Fri, negative → 0
  ];
  assert.deepEqual(bucketWeekMinutes(rows, NOW), [0, 75, 0, 0, 0, 0, 0]);
});

test('bucketWeekMinutes handles a week that spans a month boundary', () => {
  const now = new Date(2026, 9, 1); // Thu Oct 1 → week Sun Sep 27 … Sat Oct 3
  const rows = [
    { date: new Date(2026, 8, 27, 8).toISOString(), durationMinutes: 20 },
    { date: new Date(2026, 9, 3, 8).toISOString(), durationMinutes: 40 },
  ];
  assert.deepEqual(bucketWeekMinutes(rows, now), [20, 0, 0, 0, 0, 0, 40]);
});

test('bucketWeekPresence from calendar strings', () => {
  assert.deepEqual(bucketWeekPresence(['2026-09-13', '2026-09-16', '2026-09-30', 'garbage'], NOW), [true, false, false, true, false, false, false]);
});

test('scaleBars scales to max height with a floor, all-zero → floor', () => {
  assert.deepEqual(scaleBars([0, 50, 100], 100), [4, 50, 100]);
  assert.deepEqual(scaleBars([1, 100], 100, 6), [6, 100]);
  assert.deepEqual(scaleBars([0, 0, 0], 100), [4, 4, 4]);
  assert.deepEqual(scaleBars([NaN, 10], 50), [4, 50]);
});
