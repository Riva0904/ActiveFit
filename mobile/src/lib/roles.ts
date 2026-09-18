/**
 * The single source of truth for what each role can do in the app.
 *
 * Pure and RN-free on purpose: `node --test` imports this file directly (Node
 * strips the types), so the capability table is unit-tested. Keep to erasable
 * syntax — no `enum`, no parameter properties — or the test suite fails at
 * import. No React, no components, no api, no stores.
 *
 * Every row below traces to a verified backend `@Roles(...)`. When the two
 * disagree the backend wins and this table is the bug.
 */

export type Role = 'SUPER_ADMIN' | 'GYM_ADMIN' | 'STAFF' | 'TRAINER' | 'MEMBER';

/**
 * What a STAFF account actually does. The backend keeps one `Role.STAFF` — a
 * guard cannot express a sub-role — so the distinction rides alongside the role
 * and narrows the capability row rather than adding a sixth one.
 */
export type StaffType = 'FRONT_DESK' | 'CLEANING';

/** Which navigator a role gets. One shell per role, no overlap. */
export type Shell = 'PLATFORM' | 'ADMIN' | 'STAFF' | 'TRAINER' | 'MEMBER';

export type Capability =
  // platform
  | 'isPlatformOperator'
  | 'canDrillIntoAnyGym'
  | 'canEditSaaSPlans'
  | 'canSeePlatformStats'
  // attendance
  | 'canScanQr'
  | 'canCheckInOthers'
  | 'canSelfCheckIn'
  | 'canSeeGymAttendance'
  // people
  | 'canManageMembers'
  | 'canListAllMembers'
  | 'canAddPeople'
  // plans
  | 'canAuthorPlans'
  | 'canAssignPlans'
  | 'canAssignTrainers'
  // coaching
  | 'canSeeAssignedMemberProgress'
  | 'canSeeAssignedMemberAttendance'
  // front desk
  | 'canHandleEnquiries'
  | 'canConvertEnquiry'
  // employment
  | 'canRequestLeave'
  | 'canApproveLeave'
  | 'canSeeOwnSalary'
  | 'canManagePayroll'
  // money
  | 'canManageExpenses'
  | 'canViewGymFinance'
  | 'canConfirmManualUpi'
  | 'canManageGymSubscription'
  | 'canSeeMemberDues'
  | 'canManageMembershipPlans'
  | 'canManageStore'
  // chat
  | 'canAnswerMemberChat'
  | 'canChatWithGym'
  | 'canChatWithPlatform'
  | 'canManagePlatformSupport'
  | 'canCreateGroup'
  // member-only
  | 'hasMemberRecord'
  | 'canShop';

export const ROLES: ReadonlyArray<Role> = ['SUPER_ADMIN', 'GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER'];

export const ALL_CAPABILITIES: ReadonlyArray<Capability> = [
  'isPlatformOperator', 'canDrillIntoAnyGym', 'canEditSaaSPlans', 'canSeePlatformStats',
  'canScanQr', 'canCheckInOthers', 'canSelfCheckIn', 'canSeeGymAttendance',
  'canManageMembers', 'canListAllMembers', 'canAddPeople',
  'canAuthorPlans', 'canAssignPlans', 'canAssignTrainers',
  'canSeeAssignedMemberProgress', 'canSeeAssignedMemberAttendance',
  'canHandleEnquiries', 'canConvertEnquiry',
  'canRequestLeave', 'canApproveLeave', 'canSeeOwnSalary', 'canManagePayroll',
  'canManageExpenses', 'canViewGymFinance', 'canConfirmManualUpi', 'canManageGymSubscription',
  'canSeeMemberDues', 'canManageMembershipPlans', 'canManageStore',
  'canAnswerMemberChat', 'canChatWithGym', 'canChatWithPlatform', 'canManagePlatformSupport', 'canCreateGroup',
  'hasMemberRecord', 'canShop',
];

type Caps = Record<Capability, boolean>;

/**
 * Written out in full for every role rather than composed with spreads, so one
 * row can be read top to bottom and checked against the backend without
 * unpicking inheritance. The totality test guards the holes.
 */
export const CAPABILITIES: Readonly<Record<Role, Readonly<Caps>>> = {
  SUPER_ADMIN: {
    isPlatformOperator: true,
    canDrillIntoAnyGym: true,
    canEditSaaSPlans: true,      // PATCH /saas-plans/:id is @Roles(SUPER_ADMIN)
    canSeePlatformStats: true,   // GET /analytics/platform/stats
    canScanQr: false,            // /attendance/qr-check-in is GYM_ADMIN only
    canCheckInOthers: false,
    canSelfCheckIn: false,       // no gym, no attendance record
    canSeeGymAttendance: true,
    canManageMembers: true,
    canListAllMembers: true,
    canAddPeople: false,      // drill-down is read-only: accounts are created by the gym itself
    canAuthorPlans: true,
    canAssignPlans: true,
    canAssignTrainers: false,
    canSeeAssignedMemberProgress: true,
    canSeeAssignedMemberAttendance: true,
    canHandleEnquiries: false,   // enquiries are GYM_ADMIN/STAFF
    canConvertEnquiry: false,
    canRequestLeave: false,
    canApproveLeave: false,
    canSeeOwnSalary: false,
    canManagePayroll: false,     // drill-down is read-only
    canManageExpenses: false,
    canViewGymFinance: true,
    canConfirmManualUpi: false,
    canManageGymSubscription: false,
    canSeeMemberDues: true,
    canManageMembershipPlans: true,
    canManageStore: true,
    canAnswerMemberChat: false,
    canChatWithGym: false,
    canChatWithPlatform: false,
    canManagePlatformSupport: true,
    canCreateGroup: false,       // groups live inside one gym
    hasMemberRecord: false,
    canShop: false,
  },
  GYM_ADMIN: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canEditSaaSPlans: false,
    canSeePlatformStats: false,
    canScanQr: true,
    canCheckInOthers: true,
    canSelfCheckIn: false,
    canSeeGymAttendance: true,
    canManageMembers: true,
    canListAllMembers: true,
    canAddPeople: true,
    canAuthorPlans: true,
    canAssignPlans: true,
    canAssignTrainers: true,
    canSeeAssignedMemberProgress: true,
    canSeeAssignedMemberAttendance: true,
    canHandleEnquiries: true,
    canConvertEnquiry: true,
    canRequestLeave: false,
    canApproveLeave: true,
    canSeeOwnSalary: false,
    canManagePayroll: true,
    canManageExpenses: true,
    canViewGymFinance: true,
    canConfirmManualUpi: true,
    canManageGymSubscription: true,
    canSeeMemberDues: true,
    canManageMembershipPlans: true,
    canManageStore: true,
    canAnswerMemberChat: true,
    canChatWithGym: false,
    canChatWithPlatform: true,
    canManagePlatformSupport: false,
    canCreateGroup: true,        // POST /chat/groups is @Roles(GYM_ADMIN)
    hasMemberRecord: false,
    canShop: false,
  },
  STAFF: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canEditSaaSPlans: false,
    canSeePlatformStats: false,
    canScanQr: false,            // the QR kiosk is GYM_ADMIN only; staff use the code
    canCheckInOthers: true,
    canSelfCheckIn: true,
    canSeeGymAttendance: true,
    canManageMembers: false,
    canListAllMembers: false,
    canAddPeople: true,          // front desk signs people up (member or trainer)
    canAuthorPlans: false,
    canAssignPlans: false,
    canAssignTrainers: false,
    canSeeAssignedMemberProgress: false,
    canSeeAssignedMemberAttendance: false,
    canHandleEnquiries: true,
    canConvertEnquiry: false,
    canRequestLeave: true,
    canApproveLeave: false,
    canSeeOwnSalary: true,
    canManagePayroll: false,
    canManageExpenses: false,
    canViewGymFinance: false,
    canConfirmManualUpi: false,
    canManageGymSubscription: false,
    canSeeMemberDues: true,
    canManageMembershipPlans: false,
    canManageStore: false,
    canAnswerMemberChat: true,
    canChatWithGym: false,
    canChatWithPlatform: false,
    canManagePlatformSupport: false,
    canCreateGroup: false,       // may post in a group, may not create one
    hasMemberRecord: false,
    canShop: false,
  },
  TRAINER: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canEditSaaSPlans: false,
    canSeePlatformStats: false,
    canScanQr: false,
    canCheckInOthers: false,
    canSelfCheckIn: true,
    canSeeGymAttendance: false,
    canManageMembers: false,
    canListAllMembers: false,   // reads /pt-sessions/assigned-members instead
    canAddPeople: false,
    canAuthorPlans: true,
    canAssignPlans: true,
    canAssignTrainers: false,
    canSeeAssignedMemberProgress: true,
    canSeeAssignedMemberAttendance: true,
    canHandleEnquiries: false,
    canConvertEnquiry: false,
    canRequestLeave: true,
    canApproveLeave: false,
    canSeeOwnSalary: true,
    canManagePayroll: false,
    canManageExpenses: false,
    canViewGymFinance: false,
    canConfirmManualUpi: false,
    canManageGymSubscription: false,
    canSeeMemberDues: false,
    canManageMembershipPlans: false,
    canManageStore: false,
    canAnswerMemberChat: false,
    canChatWithGym: true,
    canChatWithPlatform: false,
    canManagePlatformSupport: false,
    canCreateGroup: false,
    hasMemberRecord: false,
    canShop: false,
  },
  MEMBER: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canEditSaaSPlans: false,
    canSeePlatformStats: false,
    canScanQr: false,
    canCheckInOthers: false,
    canSelfCheckIn: true,
    canSeeGymAttendance: false,
    canManageMembers: false,
    canListAllMembers: false,
    canAddPeople: false,
    canAuthorPlans: false,
    canAssignPlans: false,
    canAssignTrainers: false,
    canSeeAssignedMemberProgress: false,
    canSeeAssignedMemberAttendance: false,
    canHandleEnquiries: false,
    canConvertEnquiry: false,
    canRequestLeave: false,
    canApproveLeave: false,
    canSeeOwnSalary: false,
    canManagePayroll: false,
    canManageExpenses: false,
    canViewGymFinance: false,
    canConfirmManualUpi: false,
    canManageGymSubscription: false,
    canSeeMemberDues: false,
    canManageMembershipPlans: false,
    canManageStore: false,
    canAnswerMemberChat: false,
    canChatWithGym: true,
    canChatWithPlatform: false,
    canManagePlatformSupport: false,
    canCreateGroup: false,
    hasMemberRecord: true,
    canShop: true,
  },
};

const SHELLS: Readonly<Record<Role, Shell>> = {
  SUPER_ADMIN: 'PLATFORM',
  GYM_ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  TRAINER: 'TRAINER',
  MEMBER: 'MEMBER',
};

const TABS: Readonly<Record<Shell, ReadonlyArray<string>>> = {
  PLATFORM: ['Overview', 'Gyms', 'Approvals', 'Revenue', 'Support', 'Profile'],
  ADMIN: ['Home', 'People', 'Attendance', 'Plans', 'Money', 'Profile'],
  STAFF: ['Desk', 'Enquiries', 'Messages', 'Profile'],
  TRAINER: ['Home', 'Members', 'Sessions', 'Plans', 'Attendance', 'Profile'],
  MEMBER: ['Home', 'Attendance', 'Plans', 'Store', 'Profile'],
};

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as ReadonlyArray<string>).includes(value);
}

/** Never throws: an unknown or missing role falls back to the least-privileged shell. */
export function shellForRole(role: string | undefined | null): Shell {
  return isRole(role) ? SHELLS[role] : 'MEMBER';
}

export function tabsFor(shell: Shell): ReadonlyArray<string> {
  return TABS[shell] ?? TABS.MEMBER;
}

/**
 * What a cleaning staffer loses relative to the front desk.
 *
 * Subtracted rather than written as a sixth role row, because every other
 * capability is identical and duplicating thirty lines would be a second place
 * for the two to drift apart. The backend refuses these anyway — `POST /users`
 * checks `staffType`, and the desk screens simply have nothing to show.
 */
const CLEANING_STAFF_REVOKES: ReadonlyArray<Capability> = [
  'canAddPeople',
  'canHandleEnquiries',
  'canCheckInOthers',
  'canSeeGymAttendance',
  'canSeeMemberDues',
];

export function capsOf(role: string | undefined | null, staffType?: StaffType | null): Readonly<Caps> {
  const base = isRole(role) ? CAPABILITIES[role] : CAPABILITIES.MEMBER;
  if (role !== 'STAFF' || staffType !== 'CLEANING') return base;

  const narrowed = { ...base } as Caps;
  for (const capability of CLEANING_STAFF_REVOKES) narrowed[capability] = false;
  return narrowed;
}

/**
 * `staffType` is read off the same user object the app already carries, so a
 * screen calls `can(user, 'canAddPeople')` exactly as before and the cleaning
 * narrowing applies without any call site knowing about it.
 */
export function can(
  user: { role?: string | null; staffType?: string | null } | null | undefined,
  capability: Capability,
): boolean {
  if (!user || !isRole(user.role)) return false;
  return capsOf(user.role, user.staffType as StaffType | null | undefined)[capability] === true;
}

/** Cleaning staff get a reduced shell: attendance, leave, salary and messages. */
export function isCleaningStaff(user: { role?: string | null; staffType?: string | null } | null | undefined): boolean {
  return user?.role === 'STAFF' && user?.staffType === 'CLEANING';
}

/** Only a super admin works without a gym; every other role is tenant-scoped. */
export function needsGymScope(role: string | undefined | null): boolean {
  return role !== 'SUPER_ADMIN';
}

export function isPlatformOperator(role: string | undefined | null): boolean {
  return role === 'SUPER_ADMIN';
}

/**
 * Which chat screen the Profile menu points at, and what to call it.
 *
 * Everyone inside a gym now lands on the same private inbox — the shared "all
 * member messages" desk is gone, because it let the front desk read the
 * admin's conversations. A super admin has no gym inbox, only platform support.
 */
export function supportChatTarget(role: string | undefined | null): { screen: string; label: string } {
  if (role === 'SUPER_ADMIN') return { screen: 'SuperAdminChat', label: 'Gym admin support' };
  return { screen: 'Messages', label: 'Messages' };
}
