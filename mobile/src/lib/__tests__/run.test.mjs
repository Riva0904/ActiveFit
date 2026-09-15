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

// ─── background-tracker helpers ─────────────────────────────────────────────
import { classifyGpsQuality, acceptFix, locationToPoint, mergeLocationBatch, elapsedSeconds, projectRoute } from '../run.ts';

test('classifyGpsQuality boundaries', () => {
  assert.equal(classifyGpsQuality(null), 'none');
  assert.equal(classifyGpsQuality(undefined), 'none');
  assert.equal(classifyGpsQuality(101), 'none');
  assert.equal(classifyGpsQuality(36), 'poor');
  assert.equal(classifyGpsQuality(16), 'ok');
  assert.equal(classifyGpsQuality(15), 'good');
  assert.equal(classifyGpsQuality(3), 'good');
});

test('acceptFix: warm-up loosens the accuracy gate', () => {
  const p = { lat: 12.97, lng: 77.59, ts: 10, accuracy: 45 };
  assert.equal(acceptFix(null, p, { warmup: true }), true);
  assert.equal(acceptFix(null, p, { warmup: false }), false);
  assert.equal(acceptFix(null, { ...p, accuracy: 60 }, { warmup: true }), false);
});

test('acceptFix: rejects out-of-order timestamps and NaN', () => {
  const prev = { lat: 12.97, lng: 77.59, ts: 10, accuracy: 5 };
  assert.equal(acceptFix(prev, { lat: 12.9702, lng: 77.59, ts: 10, accuracy: 5 }), false);
  assert.equal(acceptFix(prev, { lat: 12.9702, lng: 77.59, ts: 9, accuracy: 5 }), false);
  assert.equal(acceptFix(prev, { lat: NaN, lng: 77.59, ts: 12, accuracy: 5 }), false);
});

test('acceptFix: minimum move scales with accuracy, capped at 20 m', () => {
  const prev = { lat: 12.97, lng: 77.59, ts: 10, accuracy: 5 };
  const step = (m) => ({ lat: 12.97 + m / 111195, lng: 77.59, ts: 14 });
  assert.equal(acceptFix(prev, { ...step(3.5), accuracy: 5 }), true);   // min 3 m
  assert.equal(acceptFix(prev, { ...step(8), accuracy: 20 }), false);   // needs 10 m
  assert.equal(acceptFix(prev, { ...step(11), accuracy: 20 }), true);
  assert.equal(acceptFix(prev, { ...step(19), accuracy: 50 }, { warmup: true }), false); // cap 20 m
  assert.equal(acceptFix(prev, { ...step(21), accuracy: 50 }, { warmup: true }), true);
});

test('acceptFix: rejects GPS jumps faster than 12 m/s', () => {
  const prev = { lat: 12.97, lng: 77.59, ts: 10, accuracy: 5 };
  assert.equal(acceptFix(prev, { lat: 12.97 + 500 / 111195, lng: 77.59, ts: 12, accuracy: 5 }), false);
  assert.equal(acceptFix(prev, { lat: 12.97 + 20 / 111195, lng: 77.59, ts: 12, accuracy: 5 }), true); // 10 m/s
});

test('locationToPoint converts ms → s and keeps accuracy', () => {
  const p = locationToPoint({ coords: { latitude: 1, longitude: 2, accuracy: 7 }, timestamp: 1700000000500 });
  assert.deepEqual(p, { lat: 1, lng: 2, ts: 1700000000.5, accuracy: 7 });
  assert.equal(locationToPoint({ coords: { latitude: 1, longitude: 2 }, timestamp: 0 }).accuracy, null);
});

test('mergeLocationBatch: sorts, dedupes, sums accepted legs, always reports lastFix', () => {
  const base = { lat: 12.97, lng: 77.59, ts: 100, accuracy: 5 };
  const a = { lat: 12.97 + 10 / 111195, lng: 77.59, ts: 104, accuracy: 5 };
  const b = { lat: 12.97 + 20 / 111195, lng: 77.59, ts: 108, accuracy: 5 };
  const r = mergeLocationBatch([base], [b, a, { ...a }], { acceptedCount: 10, startedAt: 0 });
  assert.equal(r.points.length, 3);
  assert.equal(r.accepted, 2);
  assert.ok(Math.abs(r.addedMeters - 20) < 0.5, `got ${r.addedMeters}`);
  assert.equal(r.lastFix.ts, 108);

  // everything rejected (bad accuracy, past warm-up) → nothing added but lastFix still set
  const bad = mergeLocationBatch([base], [{ ...b, accuracy: 90 }], { acceptedCount: 10, startedAt: 0 });
  assert.equal(bad.points.length, 1);
  assert.equal(bad.addedMeters, 0);
  assert.equal(bad.lastFix.accuracy, 90);

  // overlapping (already stored) batch adds nothing
  const again = mergeLocationBatch(r.points, [a, b], { acceptedCount: 12, startedAt: 0 });
  assert.equal(again.accepted, 0);
  assert.equal(again.addedMeters, 0);
});

test('mergeLocationBatch: warm-up by count or by time since start', () => {
  const p = { lat: 12.97, lng: 77.59, ts: 1000, accuracy: 40 };
  assert.equal(mergeLocationBatch([], [p], { acceptedCount: 0 }).accepted, 1);            // < 5 points
  assert.equal(mergeLocationBatch([], [p], { acceptedCount: 9, startedAt: 990 }).accepted, 1); // < 30 s
  assert.equal(mergeLocationBatch([], [p], { acceptedCount: 9, startedAt: 900 }).accepted, 0);
});

test('elapsedSeconds caps the open segment at `until`', () => {
  assert.equal(elapsedSeconds(100, null, 999999), 100);
  assert.equal(elapsedSeconds(100, 10_000, 25_500), 115);
  assert.equal(elapsedSeconds(100, 30_000, 25_500), 100); // until before segment start → 0 added
  assert.equal(elapsedSeconds(NaN, null, 0), 0);
});

test('projectRoute: fits with padding, north up, aspect preserved, single point centred', () => {
  const pts = [{ lat: 0, lng: 0 }, { lat: 0.01, lng: 0.01 }]; // square in degrees (cos≈1)
  const xy = projectRoute(pts, 200, 100, 10);
  assert.equal(xy.length, 2);
  // limited by height: draw box 80×80 centred in 180×80 → x from 60 to 140
  assert.ok(Math.abs(xy[0].x - 60) < 0.01 && Math.abs(xy[0].y - 90) < 0.01, JSON.stringify(xy[0]));
  assert.ok(Math.abs(xy[1].x - 140) < 0.01 && Math.abs(xy[1].y - 10) < 0.01, JSON.stringify(xy[1]));
  assert.deepEqual(projectRoute([{ lat: 5, lng: 5 }], 200, 100, 10), [{ x: 100, y: 50 }]);
  assert.deepEqual(projectRoute([], 200, 100), []);
});
