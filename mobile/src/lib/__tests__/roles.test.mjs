import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES, ALL_CAPABILITIES, CAPABILITIES,
  shellForRole, tabsFor, capsOf, can, needsGymScope, isPlatformOperator, supportChatTarget, isCleaningStaff,
} from '../roles.ts';
import { effectiveGymId, isDrilldown, scopedParams, scopedKey } from '../gymScope.ts';

test('each role gets its own shell; anything unknown falls back to MEMBER', () => {
  assert.equal(shellForRole('SUPER_ADMIN'), 'PLATFORM');
  assert.equal(shellForRole('GYM_ADMIN'), 'ADMIN');
  assert.equal(shellForRole('STAFF'), 'STAFF');
  assert.equal(shellForRole('TRAINER'), 'TRAINER');
  assert.equal(shellForRole('MEMBER'), 'MEMBER');

  const shells = ROLES.map(shellForRole);
  assert.equal(new Set(shells).size, ROLES.length, 'two roles share a shell');

  // Never throw on junk — a bad role must degrade, not crash the app at boot.
  assert.equal(shellForRole(undefined), 'MEMBER');
  assert.equal(shellForRole(null), 'MEMBER');
  assert.equal(shellForRole('WAT'), 'MEMBER');
  assert.equal(shellForRole(''), 'MEMBER');
});

test('the capability table is total — every role has every capability', () => {
  for (const role of ROLES) {
    for (const cap of ALL_CAPABILITIES) {
      assert.equal(typeof CAPABILITIES[role][cap], 'boolean', `${role}.${cap} is not a boolean`);
    }
    // No stray keys either, so the union and the table cannot drift apart.
    assert.deepEqual(Object.keys(CAPABILITIES[role]).sort(), [...ALL_CAPABILITIES].sort(), `${role} has extra/missing keys`);
  }
});

test('can() is false for a missing or unknown user', () => {
  for (const cap of ALL_CAPABILITIES) {
    assert.equal(can(null, cap), false);
    assert.equal(can(undefined, cap), false);
    assert.equal(can({}, cap), false);
    assert.equal(can({ role: 'WAT' }, cap), false);
  }
});

// Each of these mirrors a verified backend @Roles. If the backend changes, this
// is where the mismatch should surface.
test('attendance capabilities match the backend', () => {
  // /attendance/qr-check-in is @Roles(GYM_ADMIN) — staff use the member code.
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canScanQr'), true);
  assert.equal(can({ role: 'STAFF' }, 'canScanQr'), false);
  assert.equal(can({ role: 'SUPER_ADMIN' }, 'canScanQr'), false);

  // /attendance/admin-manual-check-in is @Roles(GYM_ADMIN, STAFF).
  assert.equal(can({ role: 'STAFF' }, 'canCheckInOthers'), true);
  assert.equal(can({ role: 'TRAINER' }, 'canCheckInOthers'), false);

  // self-check-in allows MEMBER, TRAINER, STAFF. The old HomeScreen omitted TRAINER.
  assert.equal(can({ role: 'TRAINER' }, 'canSelfCheckIn'), true);
  assert.equal(can({ role: 'MEMBER' }, 'canSelfCheckIn'), true);
  assert.equal(can({ role: 'STAFF' }, 'canSelfCheckIn'), true);
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canSelfCheckIn'), false);
});

test('plan authoring is admin and trainer, never staff', () => {
  for (const role of ['GYM_ADMIN', 'SUPER_ADMIN', 'TRAINER']) {
    assert.equal(can({ role }, 'canAuthorPlans'), true, role);
    assert.equal(can({ role }, 'canAssignPlans'), true, role);
  }
  assert.equal(can({ role: 'STAFF' }, 'canAuthorPlans'), false);
  assert.equal(can({ role: 'MEMBER' }, 'canAuthorPlans'), false);

  // A trainer must NOT read /users — it would expose staff and trainer rows.
  assert.equal(can({ role: 'TRAINER' }, 'canListAllMembers'), false);
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canListAllMembers'), true);
});

test('employment capabilities are staff and trainer', () => {
  for (const role of ['STAFF', 'TRAINER']) {
    assert.equal(can({ role }, 'canSeeOwnSalary'), true, role);
    assert.equal(can({ role }, 'canRequestLeave'), true, role);
  }
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canApproveLeave'), true);
  assert.equal(can({ role: 'STAFF' }, 'canApproveLeave'), false);
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canManagePayroll'), true);
  assert.equal(can({ role: 'STAFF' }, 'canManagePayroll'), false);
});

test('enquiries: staff handle them, only an admin converts', () => {
  assert.equal(can({ role: 'STAFF' }, 'canHandleEnquiries'), true);
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canHandleEnquiries'), true);
  assert.equal(can({ role: 'STAFF' }, 'canConvertEnquiry'), false);
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canConvertEnquiry'), true);
});

test('money capabilities belong to the gym admin', () => {
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canManageExpenses'), true);
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canConfirmManualUpi'), true);
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canManageGymSubscription'), true);
  // The super admin drill-down is read-only.
  assert.equal(can({ role: 'SUPER_ADMIN' }, 'canManageExpenses'), false);
  assert.equal(can({ role: 'SUPER_ADMIN' }, 'canConfirmManualUpi'), false);
  assert.equal(can({ role: 'SUPER_ADMIN' }, 'canViewGymFinance'), true);
  assert.equal(can({ role: 'STAFF' }, 'canViewGymFinance'), false);
});

test('only the member has a member record and can shop', () => {
  assert.equal(can({ role: 'MEMBER' }, 'hasMemberRecord'), true);
  assert.equal(can({ role: 'MEMBER' }, 'canShop'), true);
  for (const role of ['SUPER_ADMIN', 'GYM_ADMIN', 'STAFF', 'TRAINER']) {
    assert.equal(can({ role }, 'hasMemberRecord'), false, role);
    assert.equal(can({ role }, 'canShop'), false, role);
  }
});

test('platform capabilities belong to the super admin alone', () => {
  assert.equal(isPlatformOperator('SUPER_ADMIN'), true);
  assert.equal(can({ role: 'SUPER_ADMIN' }, 'canDrillIntoAnyGym'), true);
  assert.equal(can({ role: 'SUPER_ADMIN' }, 'canManagePlatformSupport'), true);
  for (const role of ['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER']) {
    assert.equal(isPlatformOperator(role), false, role);
    assert.equal(can({ role }, 'canDrillIntoAnyGym'), false, role);
  }
});

test('every role but the super admin is tenant-scoped', () => {
  assert.equal(needsGymScope('SUPER_ADMIN'), false);
  for (const role of ['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER']) {
    assert.equal(needsGymScope(role), true, role);
  }
});

test('the member tab bar is unchanged — a fence around the shipped app', () => {
  assert.deepEqual([...tabsFor('MEMBER')], ['Home', 'Attendance', 'Plans', 'Store', 'Profile']);
  // Staff never see the member-only tabs that returned empty lists for them.
  const staffTabs = tabsFor('STAFF');
  assert.ok(!staffTabs.includes('Store'));
  assert.ok(!staffTabs.includes('Plans'));
  assert.ok(staffTabs.includes('Desk'));
  // A trainer now gets plan authoring.
  assert.ok(tabsFor('TRAINER').includes('Plans'));
});

test('chat routes to the right screen per role', () => {
  // Everyone inside a gym shares one private inbox; the shared "all member
  // messages" desk is gone, so no role routes to it any more.
  assert.equal(supportChatTarget('SUPER_ADMIN').screen, 'SuperAdminChat');
  for (const role of ['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER']) {
    assert.equal(supportChatTarget(role).screen, 'Messages');
  }
  for (const role of [...ROLES, undefined]) {
    assert.ok(supportChatTarget(role).label.length > 0);
  }
});

// ─── gym scope ──────────────────────────────────────────────────────────────

test('a selection never overrides a tenant-scoped user', () => {
  for (const role of ['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER']) {
    assert.equal(effectiveGymId({ role, gymId: 'gym-A' }, 'gym-B'), 'gym-A', role);
    assert.equal(isDrilldown({ role, gymId: 'gym-A' }, 'gym-B'), false, role);
  }
});

test('a super admin acts on the gym they picked, and on none until they pick', () => {
  assert.equal(effectiveGymId({ role: 'SUPER_ADMIN', gymId: null }, 'gym-B'), 'gym-B');
  assert.equal(effectiveGymId({ role: 'SUPER_ADMIN', gymId: null }, null), null);
  assert.equal(effectiveGymId({ role: 'SUPER_ADMIN', gymId: null }), null);
  assert.equal(isDrilldown({ role: 'SUPER_ADMIN' }, 'gym-B'), true);
  assert.equal(isDrilldown({ role: 'SUPER_ADMIN' }, null), false);
  assert.equal(effectiveGymId(null, 'gym-B'), null);
});

test('gymId is absent, not undefined, for a tenant-scoped user', () => {
  const params = scopedParams({ role: 'GYM_ADMIN', gymId: 'gym-A' }, 'gym-B', { role: 'MEMBER' });
  assert.equal(Object.hasOwn(params, 'gymId'), false, 'a stale selection leaked into the query');
  assert.deepEqual(params, { role: 'MEMBER' });

  const drill = scopedParams({ role: 'SUPER_ADMIN' }, 'gym-B', { role: 'MEMBER' });
  assert.deepEqual(drill, { role: 'MEMBER', gymId: 'gym-B' });

  // A super admin who has not picked a gym sends nothing, so screens must gate.
  const none = scopedParams({ role: 'SUPER_ADMIN' }, null, { limit: 10 });
  assert.equal(Object.hasOwn(none, 'gymId'), false);
});

test('query keys are namespaced by gym so one tenant cannot serve another from cache', () => {
  assert.notDeepEqual(scopedKey(['attendance-list'], 'gym-A'), scopedKey(['attendance-list'], 'gym-B'));
  assert.deepEqual(scopedKey(['attendance-list'], 'gym-A'), ['attendance-list', 'gym-A']);
  assert.deepEqual(scopedKey(['x'], null), ['x', 'none']);
  assert.deepEqual(scopedKey(['x'], undefined), ['x', 'none']);
});

test('only a gym admin may create a chat group', () => {
  // Mirrors POST /chat/groups, which is @Roles(GYM_ADMIN). Everyone else can
  // post in a group they were added to — they just cannot make one.
  assert.equal(can({ role: 'GYM_ADMIN' }, 'canCreateGroup'), true);
  for (const role of ['SUPER_ADMIN', 'STAFF', 'TRAINER', 'MEMBER']) {
    assert.equal(can({ role }, 'canCreateGroup'), false, `${role} must not create groups`);
  }
  assert.equal(can(null, 'canCreateGroup'), false);
});

test('cleaning staff lose the front desk’s duties but keep their own', () => {
  // Both are Role.STAFF — the backend guard cannot tell them apart, so the
  // narrowing has to be reliable here and enforced again server-side.
  const desk = { role: 'STAFF', staffType: 'FRONT_DESK' };
  const cleaner = { role: 'STAFF', staffType: 'CLEANING' };

  for (const cap of ['canAddPeople', 'canHandleEnquiries', 'canCheckInOthers', 'canSeeGymAttendance', 'canSeeMemberDues']) {
    assert.equal(can(desk, cap), true, `front desk should keep ${cap}`);
    assert.equal(can(cleaner, cap), false, `cleaning staff should lose ${cap}`);
  }

  // Their own employment and attendance are untouched.
  for (const cap of ['canSelfCheckIn', 'canRequestLeave', 'canSeeOwnSalary', 'canAnswerMemberChat']) {
    assert.equal(can(cleaner, cap), true, `cleaning staff should keep ${cap}`);
  }
});

test('an unknown or missing staffType is treated as front desk', () => {
  // The column defaults to FRONT_DESK and older tokens carry no staffType at
  // all; neither should silently strip the desk from someone who needs it.
  assert.equal(can({ role: 'STAFF' }, 'canAddPeople'), true);
  assert.equal(can({ role: 'STAFF', staffType: null }, 'canAddPeople'), true);
  assert.equal(can({ role: 'STAFF', staffType: 'NONSENSE' }, 'canAddPeople'), true);
});

test('staffType never affects a non-staff role', () => {
  // A stale staffType riding on a member's profile must not narrow anything.
  assert.equal(can({ role: 'MEMBER', staffType: 'CLEANING' }, 'canShop'), true);
  assert.equal(can({ role: 'GYM_ADMIN', staffType: 'CLEANING' }, 'canAddPeople'), true);
});

test('capsOf stays total for both staff variants', () => {
  for (const staffType of ['FRONT_DESK', 'CLEANING']) {
    const caps = capsOf('STAFF', staffType);
    for (const cap of ALL_CAPABILITIES) {
      assert.equal(typeof caps[cap], 'boolean', `${staffType} is missing ${cap}`);
    }
  }
});

test('isCleaningStaff only matches a cleaning staff account', () => {
  assert.equal(isCleaningStaff({ role: 'STAFF', staffType: 'CLEANING' }), true);
  assert.equal(isCleaningStaff({ role: 'STAFF', staffType: 'FRONT_DESK' }), false);
  assert.equal(isCleaningStaff({ role: 'STAFF' }), false);
  assert.equal(isCleaningStaff({ role: 'TRAINER', staffType: 'CLEANING' }), false);
  assert.equal(isCleaningStaff(null), false);
});
