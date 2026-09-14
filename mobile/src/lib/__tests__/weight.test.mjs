import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEIGHT_MIN, WEIGHT_MAX, STEP, PX_PER_STEP, TICK_COUNT,
  clampWeight, snapWeight, weightToOffset, offsetToWeight, tickKind, tickLabel, latestWeight,
} from '../weight.ts';

test('constants describe a 30–200 kg ruler in 0.5 kg steps', () => {
  assert.equal(TICK_COUNT, (WEIGHT_MAX - WEIGHT_MIN) / STEP + 1);
  assert.equal(TICK_COUNT, 341);
});

test('snapWeight snaps to 0.5 and clamps', () => {
  assert.equal(snapWeight(45.24), 45);
  assert.equal(snapWeight(45.25), 45.5);
  assert.equal(snapWeight(45.74), 45.5);
  assert.equal(snapWeight(10), WEIGHT_MIN);
  assert.equal(snapWeight(999), WEIGHT_MAX);
  assert.equal(clampWeight(NaN), WEIGHT_MIN);
});

test('weightToOffset ↔ offsetToWeight round-trip on every tick', () => {
  for (let i = 0; i < TICK_COUNT; i++) {
    const kg = WEIGHT_MIN + i * STEP;
    const px = weightToOffset(kg);
    assert.equal(px, i * PX_PER_STEP);
    assert.equal(offsetToWeight(px), kg);
  }
});

test('offsetToWeight snaps mid-scroll positions and clamps overscroll', () => {
  assert.equal(offsetToWeight(PX_PER_STEP * 2.4), WEIGHT_MIN + STEP * 2);
  assert.equal(offsetToWeight(PX_PER_STEP * 2.6), WEIGHT_MIN + STEP * 3);
  assert.equal(offsetToWeight(-500), WEIGHT_MIN);
  assert.equal(offsetToWeight(1e9), WEIGHT_MAX);
  assert.equal(offsetToWeight(NaN), WEIGHT_MIN);
});

test('tickKind: major every 5 kg, mid every 1 kg, minor at halves', () => {
  assert.equal(tickKind(0), 'major');          // 30
  assert.equal(tickKind(1), 'minor');          // 30.5
  assert.equal(tickKind(2), 'mid');            // 31
  assert.equal(tickKind(10), 'major');         // 35
  assert.equal(tickLabel(10), '35');
  assert.equal(tickLabel(1), '30.5');
});

test('latestWeight picks the newest entry that has a weight', () => {
  const logs = [
    { weight: 70, logDate: '2026-09-01T00:00:00Z' },
    { weight: null, logDate: '2026-09-10T00:00:00Z' },
    { weight: 68.5, logDate: '2026-09-05T00:00:00Z' },
    { bodyFat: 20, createdAt: '2026-09-12T00:00:00Z' },
  ];
  assert.equal(latestWeight(logs), 68.5);
  assert.equal(latestWeight([]), null);
  assert.equal(latestWeight([{ weight: 72, createdAt: '2026-01-01' }, { weight: 71, logDate: '2026-02-01' }]), 71);
});
