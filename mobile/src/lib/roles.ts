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

/** Which navigator a role gets. One shell per role, no overlap. */
export type Shell = 'PLATFORM' | 'ADMIN' | 'STAFF' | 'TRAINER' | 'MEMBER';

export type Capability =
  // platform
  | 'isPlatformOperator'
  | 'canDrillIntoAnyGym'
  // attendance
  | 'canScanQr'
  | 'canCheckInOthers'
  | 'canSelfCheckIn'
  | 'canSeeGymAttendance'
  // people
  | 'canManageMembers'
  | 'canListAllMembers'
  // plans
  | 'canAuthorPlans'
  | 'canAssignPlans'
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
  // chat
  | 'canAnswerMemberChat'
  | 'canChatWithGym'
  | 'canChatWithPlatform'
  | 'canManagePlatformSupport'
  // member-only
  | 'hasMemberRecord'
  | 'canShop';

export const ROLES: ReadonlyArray<Role> = ['SUPER_ADMIN', 'GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER'];

export const ALL_CAPABILITIES: ReadonlyArray<Capability> = [
  'isPlatformOperator', 'canDrillIntoAnyGym',
  'canScanQr', 'canCheckInOthers', 'canSelfCheckIn', 'canSeeGymAttendance',
  'canManageMembers', 'canListAllMembers',
  'canAuthorPlans', 'canAssignPlans',
  'canHandleEnquiries', 'canConvertEnquiry',
  'canRequestLeave', 'canApproveLeave', 'canSeeOwnSalary', 'canManagePayroll',
  'canManageExpenses', 'canViewGymFinance', 'canConfirmManualUpi', 'canManageGymSubscription',
  'canAnswerMemberChat', 'canChatWithGym', 'canChatWithPlatform', 'canManagePlatformSupport',
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
    canScanQr: false,            // /attendance/qr-check-in is GYM_ADMIN only
    canCheckInOthers: false,
    canSelfCheckIn: false,       // no gym, no attendance record
    canSeeGymAttendance: true,
    canManageMembers: true,
    canListAllMembers: true,
    canAuthorPlans: true,
    canAssignPlans: true,
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
    canAnswerMemberChat: false,
    canChatWithGym: false,
    canChatWithPlatform: false,
    canManagePlatformSupport: true,
    hasMemberRecord: false,
    canShop: false,
  },
  GYM_ADMIN: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canScanQr: true,
    canCheckInOthers: true,
    canSelfCheckIn: false,
    canSeeGymAttendance: true,
    canManageMembers: true,
    canListAllMembers: true,
    canAuthorPlans: true,
    canAssignPlans: true,
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
    canAnswerMemberChat: true,
    canChatWithGym: false,
    canChatWithPlatform: true,
    canManagePlatformSupport: false,
    hasMemberRecord: false,
    canShop: false,
  },
  STAFF: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canScanQr: false,            // the QR kiosk is GYM_ADMIN only; staff use the code
    canCheckInOthers: true,
    canSelfCheckIn: true,
    canSeeGymAttendance: true,
    canManageMembers: false,
    canListAllMembers: false,
    canAuthorPlans: false,
    canAssignPlans: false,
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
    canAnswerMemberChat: true,
    canChatWithGym: false,
    canChatWithPlatform: false,
    canManagePlatformSupport: false,
    hasMemberRecord: false,
    canShop: false,
  },
  TRAINER: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canScanQr: false,
    canCheckInOthers: false,
    canSelfCheckIn: true,
    canSeeGymAttendance: false,
    canManageMembers: false,
    canListAllMembers: false,   // reads /pt-sessions/assigned-members instead
    canAuthorPlans: true,
    canAssignPlans: true,
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
    canAnswerMemberChat: false,
    canChatWithGym: true,
    canChatWithPlatform: false,
    canManagePlatformSupport: false,
    hasMemberRecord: false,
    canShop: false,
  },
  MEMBER: {
    isPlatformOperator: false,
    canDrillIntoAnyGym: false,
    canScanQr: false,
    canCheckInOthers: false,
    canSelfCheckIn: true,
    canSeeGymAttendance: false,
    canManageMembers: false,
    canListAllMembers: false,
    canAuthorPlans: false,
    canAssignPlans: false,
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
    canAnswerMemberChat: false,
    canChatWithGym: true,
    canChatWithPlatform: false,
    canManagePlatformSupport: false,
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
  PLATFORM: ['Gyms', 'Approvals', 'Revenue', 'Support', 'Profile'],
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

export function capsOf(role: string | undefined | null): Readonly<Caps> {
  return isRole(role) ? CAPABILITIES[role] : CAPABILITIES.MEMBER;
}

export function can(user: { role?: string | null } | null | undefined, capability: Capability): boolean {
  if (!user || !isRole(user.role)) return false;
  return CAPABILITIES[user.role][capability] === true;
}

/** Only a super admin works without a gym; every other role is tenant-scoped. */
export function needsGymScope(role: string | undefined | null): boolean {
  return role !== 'SUPER_ADMIN';
}

export function isPlatformOperator(role: string | undefined | null): boolean {
  return role === 'SUPER_ADMIN';
}

/** Which chat screen the Profile menu points at, and what to call it. */
export function supportChatTarget(role: string | undefined | null): { screen: string; label: string } {
  if (role === 'SUPER_ADMIN') return { screen: 'SuperAdminChat', label: 'Gym admin support' };
  if (role === 'GYM_ADMIN') return { screen: 'GymAdminChat', label: 'Member messages' };
  if (role === 'STAFF') return { screen: 'GymAdminChat', label: 'Member messages' };
  return { screen: 'Chat', label: 'Chat with the gym' };
}
