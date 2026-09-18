import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class MobileService {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
  ) {}

  /**
   * Compressed home data — all info the mobile home screen needs in a single DB round-trip.
   */
  async getHomeData(userId: string, gymId: string | null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // SUPER_ADMIN has no gym: return the account shell only. Passing null into the
    // non-nullable gymId filters below is a Prisma validation error (500).
    if (!gymId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, role: true },
      });
      return {
        user, membership: null, memberCode: null, qrToken: null,
        activeWorkout: null, activeDiet: null, isCheckedInToday: false, checkedInAt: null,
        weeklyGoal: 0, visitsThisWeek: 0,
      };
    }

    // Monday-start week, so "3 of 5 this week" resets when the member expects.
    const weekStart = new Date(today);
    const dow = (weekStart.getDay() + 6) % 7; // Monday = 0
    weekStart.setDate(weekStart.getDate() - dow);

    const [user, member, attendance, weekVisits] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, avatar: true, role: true,
          gym: { select: { id: true, name: true, logo: true } },
        },
      }),
      this.prisma.member.findFirst({
        where: { userId, gymId },
        include: {
          memberSubscriptions: {
            where: { status: 'ACTIVE', gymId },
            include: { plan: { select: { name: true, type: true, durationMonths: true } } },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          workoutAssignments: {
            where: { isActive: true, gymId },
            include: { workoutPlan: { select: { id: true, name: true, goal: true, difficulty: true } } },
            take: 1,
          },
          dietAssignments: {
            where: { isActive: true, gymId },
            include: { dietPlan: { select: { id: true, name: true } } },
            take: 1,
          },
        },
      }),
      this.prisma.attendance.findFirst({
        where: { userId, gymId, checkInTime: { gte: today }, checkOutTime: null },
      }),
      this.prisma.attendance.findMany({
        where: { userId, gymId, checkInTime: { gte: weekStart } },
        select: { checkInTime: true },
      }),
    ]);

    // Two visits on one day are one day towards the goal.
    const daysThisWeek = new Set(weekVisits.map((v) => v.checkInTime.toISOString().slice(0, 10))).size;

    return {
      user,
      membership: member?.memberSubscriptions[0] ?? null,
      memberCode: member?.memberCode ?? null,
      qrToken: member?.qrToken ?? null,
      activeWorkout: member?.workoutAssignments[0]?.workoutPlan ?? null,
      activeDiet: member?.dietAssignments[0]?.dietPlan ?? null,
      isCheckedInToday: !!attendance,
      checkedInAt: attendance?.checkInTime ?? null,
      weeklyGoal: member?.weeklyGoal ?? 3,
      visitsThisWeek: daysThisWeek,
    };
  }

  /** The member's own weekly session target. */
  async setWeeklyGoal(userId: string, gymId: string, weeklyGoal: number) {
    const member = await this.memberOf(userId, gymId);
    const goal = Math.min(7, Math.max(1, Math.round(weeklyGoal)));
    await this.prisma.member.update({ where: { id: member.id }, data: { weeklyGoal: goal } });
    return { weeklyGoal: goal };
  }

  async registerPushToken(userId: string, token: string, platform: 'ios' | 'android', deviceId?: string) {
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, deviceId, isActive: true },
      create: { userId, token, platform, deviceId },
    });
    return { registered: true };
  }

  async deactivatePushToken(token: string) {
    await this.prisma.pushToken.updateMany({ where: { token }, data: { isActive: false } });
    return { deactivated: true };
  }

  async getTrainerHomeData(userId: string, gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trainer = await this.prisma.trainer.findFirst({
      where: { userId, gymId },
      select: {
        id: true,
        _count: { select: { memberAssignments: true } },
      },
    });

    const [todaySessions, attendance, unreadCount] = await Promise.all([
      trainer
        ? this.prisma.ptSession.findMany({
            where: { trainerId: trainer.id, scheduledAt: { gte: today, lt: tomorrow } },
            orderBy: { scheduledAt: 'asc' },
            take: 5,
            include: {
              member: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          })
        : Promise.resolve([]),
      this.prisma.attendance.findFirst({
        where: { userId, gymId, checkInTime: { gte: today }, checkOutTime: null },
      }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      assignedMembersCount: trainer?._count.memberAssignments ?? 0,
      sessionsToday: todaySessions.length,
      nextSession: todaySessions[0]
        ? {
            id: todaySessions[0].id,
            memberName: `${todaySessions[0].member.user.firstName} ${todaySessions[0].member.user.lastName}`,
            scheduledAt: todaySessions[0].scheduledAt,
            durationMinutes: todaySessions[0].duration,
          }
        : null,
      isCheckedInToday: !!attendance,
      checkedInAt: attendance?.checkInTime ?? null,
      unreadNotifications: unreadCount,
    };
  }

  async selfCheckIn(userId: string, gymId: string) {
    return this.attendanceService.selfCheckIn(userId, gymId);
  }

  // ─── Daily log (Home checklist + water + calories) ────────────────────────

  /**
   * The client sends its own local calendar day, because "today" is the device's
   * day and the server may be in another timezone. Anything unparseable falls
   * back to the server's date rather than throwing.
   */
  private dayOf(dateKey?: string): Date {
    const d = dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? new Date(`${dateKey}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(d.getTime())) return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
    return new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  }

  private async memberOf(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId }, select: { id: true } });
    if (!member) throw new NotFoundException('No member record for this account');
    return member;
  }

  private shape(log: { date: Date; items: unknown; waterMl: number; caloriesIn: number | null; notes: string | null } | null, date: Date) {
    return {
      date: (log?.date ?? date).toISOString().slice(0, 10),
      items: (log?.items && typeof log.items === 'object' ? log.items : {}) as Record<string, boolean>,
      waterMl: log?.waterMl ?? 0,
      caloriesIn: log?.caloriesIn ?? null,
      notes: log?.notes ?? null,
    };
  }

  async getDailyLog(userId: string, gymId: string, dateKey?: string) {
    const member = await this.memberOf(userId, gymId);
    const date = this.dayOf(dateKey);
    const log = await this.prisma.memberDailyLog.findUnique({
      where: { memberId_date: { memberId: member.id, date } },
    });
    return this.shape(log, date);
  }

  async upsertDailyLog(
    userId: string,
    gymId: string,
    body: { date?: string; items?: Record<string, boolean>; waterMl?: number; caloriesIn?: number | null; notes?: string | null },
  ) {
    const member = await this.memberOf(userId, gymId);
    const date = this.dayOf(body.date);

    // Only booleans survive: `items` is free-form JSON from a client, so it is
    // normalised rather than stored as sent.
    const items: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(body.items ?? {})) {
      if (typeof key === 'string' && key.length <= 40) items[key] = value === true;
    }

    const clampInt = (n: unknown, max: number): number | undefined =>
      typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : undefined;

    const waterMl = clampInt(body.waterMl, 20_000);
    const caloriesIn = body.caloriesIn === null ? null : clampInt(body.caloriesIn, 20_000);
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : body.notes === null ? null : undefined;

    const log = await this.prisma.memberDailyLog.upsert({
      where: { memberId_date: { memberId: member.id, date } },
      update: {
        ...(body.items !== undefined && { items }),
        ...(waterMl !== undefined && { waterMl }),
        ...(caloriesIn !== undefined && { caloriesIn }),
        ...(notes !== undefined && { notes }),
      },
      create: {
        memberId: member.id,
        gymId,
        date,
        items,
        waterMl: waterMl ?? 0,
        caloriesIn: caloriesIn ?? null,
        notes: notes ?? null,
      },
    });
    return this.shape(log, date);
  }
}
