import { BadRequestException } from '@nestjs/common';
import { AttendanceController } from '../../../src/attendance/attendance.controller';
import { PaymentsController } from '../../../src/payments/payments.controller';
import { WorkoutPlansController } from '../../../src/workout-plans/workout-plans.controller';
import { DietPlansController } from '../../../src/diet-plans/diet-plans.controller';
import { MembershipsController } from '../../../src/memberships/memberships.controller';
import { ExpensesController } from '../../../src/expenses/expenses.controller';
import { SalaryPayoutsController } from '../../../src/salary-payouts/salary-payouts.controller';
import { GymSubscriptionsController } from '../../../src/gym-subscriptions/gym-subscriptions.controller';
import { ChatController } from '../../../src/chat/chat.controller';
import { EnquiriesController } from '../../../src/enquiries/enquiries.controller';

const OWN = 'gym-own';
const OTHER = 'gym-other';
const ADMIN = { role: 'GYM_ADMIN', gymId: OWN, id: 'u1' };
const SUPER = { role: 'SUPER_ADMIN', gymId: null, id: 'u0' };

/** Records the gymId a handler forwards, whatever the service method is called. */
function spyService() {
  const calls: any[] = [];
  return new Proxy({} as any, {
    get: () => (...args: any[]) => {
      calls.push(args);
      return args;
    },
    // The controllers only ever call methods, but `calls` must stay reachable.
    has: () => true,
  }) as any;
}

/**
 * Every drill-down read: a SUPER_ADMIN's `?gymId=` reaches the service, a gym
 * admin's is ignored in favour of their own gym, and a SUPER_ADMIN who picked
 * no gym gets a 400 rather than a silent widening to every tenant.
 *
 * Each case is [name, call] where call(user, requestedGymId) returns the args
 * the service was handed; the gymId is asserted by position.
 */
type Case = [name: string, call: (user: any, gymId?: string) => any[], gymIdArgIndex: number];

const cases: Case[] = [
  ['attendance stats/today', (u, g) => new AttendanceController(svc(), svc()).getTodayStats(u, g) as any, 0],
  ['attendance stats/weekly', (u, g) => new AttendanceController(svc(), svc()).getWeeklyReport(u, g) as any, 0],
  ['attendance occupancy', (u, g) => new AttendanceController(svc(), svc()).getOccupancy(u, g) as any, 0],
  ['attendance occupancy-trend', (u, g) => new AttendanceController(svc(), svc()).getOccupancyTrend(u, g) as any, 0],
  ['attendance leaderboard', (u, g) => new AttendanceController(svc(), svc()).getLeaderboard(u, g) as any, 0],
  ['attendance analytics', (u, g) => new AttendanceController(svc(), svc()).getAnalytics(u, g) as any, 0],
  ['attendance inactive-members', (u, g) => new AttendanceController(svc(), svc()).getInactiveMembers(u, g) as any, 0],
  ['payments stats', (u, g) => new PaymentsController(svc()).getStats(u, g) as any, 0],
  ['payments stats/monthly', (u, g) => new PaymentsController(svc()).getMonthlyStats(u, g) as any, 0],
  ['payments manual-upi/pending', (u, g) => new PaymentsController(svc()).getPendingManualUpi(u, g) as any, 0],
  ['workout-plans manage/all', (u, g) => new WorkoutPlansController(svc()).listAll({ gymId: g }, u) as any, 0],
  ['diet-plans manage/all', (u, g) => new DietPlansController(svc()).listAll({ gymId: g }, u) as any, 0],
  ['memberships plans', (u, g) => new MembershipsController(svc()).findAllPlans(u, g) as any, 0],
  ['expenses list', (u, g) => new ExpensesController(svc()).findAll({ gymId: g }, u) as any, 0],
  ['expenses monthly-totals', (u, g) => new ExpensesController(svc()).getMonthlyTotals('2026', u, g) as any, 0],
  ['expenses audit', (u, g) => new ExpensesController(svc()).getAuditReport('9', '2026', u, g) as any, 0],
  ['salary payouts', (u, g) => new SalaryPayoutsController(svc()).findAll({ gymId: g }, u) as any, 0],
  ['subscription me', (u, g) => new GymSubscriptionsController(svc()).me(u, g) as any, 0],
  ['subscription history', (u, g) => new GymSubscriptionsController(svc()).history(u, g) as any, 0],
  ['subscription requests', (u, g) => new GymSubscriptionsController(svc()).requests(u, g) as any, 0],
  ['chat conversations', (u, g) => new ChatController(svc()).getAllConversations(u, g) as any, 0],
  ['chat conversation messages', (u, g) => new ChatController(svc()).getConversationMessages(u, 'm1', 0, g) as any, 0],
  ['enquiries list', (u, g) => new EnquiriesController(svc()).findAll(u, undefined, undefined, undefined, undefined, undefined, g) as any, 0],
  ['enquiries kanban-stats', (u, g) => new EnquiriesController(svc()).kanbanStats(u, g) as any, 0],
  ['enquiries detail', (u, g) => new EnquiriesController(svc()).findOne('e1', u, g) as any, 1],
];

// Each handler returns whatever the (proxied) service returned, which is the
// argument array itself — so the assertion reads the real forwarded gymId.
function svc() {
  return spyService();
}

describe('super-admin drill-down reads', () => {
  it.each(cases)('%s forwards the chosen gym for a SUPER_ADMIN', (_name, call, idx) => {
    expect(call(SUPER, OTHER)[idx]).toBe(OTHER);
  });

  it.each(cases)('%s ignores a GYM_ADMIN-supplied gymId', (_name, call, idx) => {
    expect(call(ADMIN, OTHER)[idx]).toBe(OWN);
  });

  it.each(cases)('%s rejects a SUPER_ADMIN with no gym chosen', (_name, call) => {
    expect(() => call(SUPER, undefined)).toThrow(BadRequestException);
  });
});
