import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineMeters, totalDistance, paceSecPerKm, formatPace, formatDuration, formatDistance, formatKm,
  groupThousands, estimateKcal, filterPoint, buildRunPayload,
} from '../run.ts';

test('haversine: 0.01° of latitude ≈ 1 111.95 m; same point = 0', () => {
  const d = haversineMeters({ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.59 });
  assert.ok(Math.abs(d - 1111.95) < 1, `got ${d}`);
  assert.equal(haversineMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0);
});

test('totalDistance sums consecutive legs', () => {
  const pts = [{ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 }, { lat: 0.02, lng: 0 }];
  const d = totalDistance(pts);
  assert.ok(Math.abs(d - 2 * 1111.95) < 2);
  assert.equal(totalDistance([]), 0);
  assert.equal(totalDistance([{ lat: 0, lng: 0 }]), 0);
});

test('pace is null under 100 m or with no time; otherwise sec/km', () => {
  assert.equal(paceSecPerKm(0, 60), null);
  assert.equal(paceSecPerKm(50, 60), null);
  assert.equal(paceSecPerKm(1000, 0), null);
  assert.equal(paceSecPerKm(1000, 300), 300);
  assert.equal(paceSecPerKm(8566, 2653), 2653 / 8.566);
});

test('formatPace', () => {
  assert.equal(formatPace(332), `5'32"`);
  assert.equal(formatPace(300.4), `5'00"`);
  assert.equal(formatPace(null), `—'—"`);
});

test('formatDuration', () => {
  assert.equal(formatDuration(2653), '44:13');
  assert.equal(formatDuration(5), '0:05');
  assert.equal(formatDuration(3853), '1:04:13');
  assert.equal(formatDuration(-3), '0:00');
  assert.equal(formatDuration(NaN), '0:00');
});

test('formatDistance uses thin-space thousands like the reference', () => {
  assert.equal(formatDistance(8566), '8 566 m');
  assert.equal(formatDistance(999), '999 m');
  assert.equal(formatDistance(1234567), '1234.6 km');
  assert.equal(formatKm(8566), '8.57 km');
  assert.equal(groupThousands(67889), '67 889');
});

test('estimateKcal ≈ 1.036 kcal/kg/km, default 70 kg', () => {
  assert.equal(estimateKcal(10000), Math.round(10 * 70 * 1.036));
  assert.equal(estimateKcal(5000, 60), Math.round(5 * 60 * 1.036));
  assert.equal(estimateKcal(0), 0);
  assert.equal(estimateKcal(1000, 0), Math.round(1 * 70 * 1.036)); // bad weight → default
});

test('filterPoint drops inaccurate fixes and jitter', () => {
  const prev = { lat: 12.97, lng: 77.59, ts: 1 };
  assert.equal(filterPoint(null, { lat: 12.97, lng: 77.59, ts: 1, accuracy: 10 }), true);
  assert.equal(filterPoint(null, { lat: 12.97, lng: 77.59, ts: 1, accuracy: 80 }), false);
  assert.equal(filterPoint(prev, { lat: 12.970005, lng: 77.59, ts: 2 }), false); // ~0.5 m
  assert.equal(filterPoint(prev, { lat: 12.9701, lng: 77.59, ts: 2 }), true);    // ~11 m
  assert.equal(filterPoint(prev, { lat: NaN, lng: 77.59, ts: 2 }), false);
  assert.equal(filterPoint(prev, { lat: 12.9701, lng: 77.59, ts: 2, accuracy: 10 }, { minMeters: 20 }), false);
});

test('buildRunPayload produces the CreateRunDto shape', () => {
  const start = new Date('2026-09-14T06:00:00Z');
  const end = new Date('2026-09-14T06:44:13Z');
  const pts = [{ lat: 0, lng: 0, ts: 1.4 }, { lat: 0.01, lng: 0, ts: 100.6 }];
  const p = buildRunPayload(pts, start, end, 2653, 70);
  assert.equal(p.startedAt, start.toISOString());
  assert.equal(p.endedAt, end.toISOString());
  assert.equal(p.distanceMeters, 1112);
  assert.equal(p.durationSec, 2653);
  assert.equal(p.calories, estimateKcal(1112, 70));
  assert.deepEqual(p.route, [{ lat: 0, lng: 0, ts: 1 }, { lat: 0.01, lng: 0, ts: 101 }]);
  assert.equal(buildRunPayload([], start, end, 0.2).durationSec, 1);
});
