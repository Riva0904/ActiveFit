import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveGymId, isDrilldown, scopedParams, scopedKey } from '../gymScope.ts';

const SUPER = { role: 'SUPER_ADMIN', gymId: null };
const ADMIN = { role: 'GYM_ADMIN', gymId: 'gym-A' };
const A = 'gym-A';
const B = 'gym-B';

test('a selection never overrides a scoped user’s own gym', () => {
  for (const role of ['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER']) {
    assert.equal(effectiveGymId({ role, gymId: A }, B), A);
  }
});

test('only a super admin can be inside another gym', () => {
  assert.equal(effectiveGymId(SUPER, B), B);
  assert.equal(effectiveGymId(SUPER, null), null);
  assert.equal(isDrilldown(SUPER, B), true);
  assert.equal(isDrilldown(SUPER, null), false);
  assert.equal(isDrilldown(ADMIN, B), false);
});

test('no user means no gym', () => {
  assert.equal(effectiveGymId(null, B), null);
  assert.equal(isDrilldown(undefined, B), false);
});

// Absent, not undefined: an undefined value can still be serialised onto the
// URL by a param builder, an absent key cannot.
test('gymId is absent from params for every non-super role', () => {
  const params = scopedParams(ADMIN, B, { limit: 50 });
  assert.equal('gymId' in params, false);
  assert.deepEqual(params, { limit: 50 });
});

test('gymId is present only during a drill-down', () => {
  assert.deepEqual(scopedParams(SUPER, B, { limit: 50 }), { limit: 50, gymId: B });
  assert.equal('gymId' in scopedParams(SUPER, null, {}), false);
});

test('scopedParams copies rather than mutating the caller’s object', () => {
  const extra = { limit: 50 };
  scopedParams(SUPER, B, extra);
  assert.deepEqual(extra, { limit: 50 });
});

// The cache-bleed fence: two gyms must never share a cache entry.
test('two gyms produce different query keys', () => {
  assert.notDeepEqual(scopedKey(['attendance-list'], A), scopedKey(['attendance-list'], B));
  assert.deepEqual(scopedKey(['attendance-list'], A), ['attendance-list', A]);
});

test('a missing gym gets its own key rather than colliding with a real one', () => {
  assert.deepEqual(scopedKey(['x'], null), ['x', 'none']);
  assert.deepEqual(scopedKey(['x'], undefined), ['x', 'none']);
});
