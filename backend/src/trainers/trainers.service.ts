import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { scopedWhere } from '../common/utils/gym-scope';
import { UpdateTrainerDto } from './dto/update-trainer.dto';

@Injectable()
export class TrainersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any, gymId?: string) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * +limit;
    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [trainers, total] = await Promise.all([
      this.prisma.trainer.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, isActive: true, payoutUpiVpa: true } },
          _count: { select: { memberAssignments: true } },
        },
      }),
      this.prisma.trainer.count({ where }),
    ]);

    return { data: trainers, total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) };
  }

  /** `gymId` = caller's tenant scope (undefined for SUPER_ADMIN); cross-tenant ids 404. */
  async findOne(id: string, gymId?: string) {
    const trainer = await this.prisma.trainer.findFirst({
      where: { id, ...scopedWhere(gymId) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
        memberAssignments: {
          where: { isActive: true },
          include: { member: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } } },
        },
      },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');
    return trainer;
  }

  /**
   * `selfUserId` is set when the caller is a TRAINER editing from their own settings
   * page — they may only touch the trainer row linked to their own user account.
   */
  async update(id: string, data: UpdateTrainerDto, gymId?: string, selfUserId?: string) {
    const trainer = await this.findOne(id, gymId);
    if (selfUserId && trainer.userId !== selfUserId) throw new NotFoundException('Trainer not found');
    return this.prisma.trainer.update({ where: { id }, data });
  }

  async remove(id: string, gymId?: string) {
    const trainer = await this.prisma.trainer.findFirst({
      where: { id, ...scopedWhere(gymId) },
      select: { userId: true },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');
    await this.prisma.trainer.delete({ where: { id } });
    await this.prisma.user.delete({ where: { id: trainer.userId } }).catch(() => {});
    return { message: 'Trainer removed successfully' };
  }

  async assignMember(trainerId: string, memberIdOrUserId: string, gymId: string) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, gymId } });
    if (!trainer) throw new NotFoundException('Trainer not found in this gym');

    // Accept either the Member table ID or the User ID
    let member = await this.prisma.member.findFirst({ where: { id: memberIdOrUserId, gymId } });
    if (!member) {
      member = await this.prisma.member.findFirst({ where: { userId: memberIdOrUserId, gymId } });
    }
    if (!member) throw new NotFoundException('Member not found in this gym');

    return this.prisma.trainerAssignment.upsert({
      where: { trainerId_memberId: { trainerId, memberId: member.id } },
      create: { trainerId, memberId: member.id, gymId, isActive: true },
      update: { isActive: true },
    });
  }

  /** Members currently assigned to this trainer. */
  async listAssignments(trainerId: string, gymId: string) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, gymId } });
    if (!trainer) throw new NotFoundException('Trainer not found in this gym');

    const assignments = await this.prisma.trainerAssignment.findMany({
      where: { trainerId, gymId, isActive: true },
      include: {
        member: {
          select: {
            id: true,
            memberCode: true,
            user: { select: { id: true, firstName: true, lastName: true, avatar: true, phone: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((a) => ({
      assignedAt: a.assignedAt,
      notes: a.notes,
      memberId: a.member.id,
      memberCode: a.member.memberCode,
      ...a.member.user,
    }));
  }

  /**
   * Ends an assignment. Soft, matching `assignMember`'s upsert — the row is kept
   * so re-assigning the same pair does not collide with the unique key, and so
   * past coaching history is not silently erased.
   */
  async unassignMember(trainerId: string, memberIdOrUserId: string, gymId: string) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, gymId } });
    if (!trainer) throw new NotFoundException('Trainer not found in this gym');

    const member =
      (await this.prisma.member.findFirst({ where: { id: memberIdOrUserId, gymId } })) ??
      (await this.prisma.member.findFirst({ where: { userId: memberIdOrUserId, gymId } }));
    if (!member) throw new NotFoundException('Member not found in this gym');

    const { count } = await this.prisma.trainerAssignment.updateMany({
      where: { trainerId, memberId: member.id, gymId },
      data: { isActive: false },
    });
    if (count === 0) throw new NotFoundException('That member is not assigned to this trainer');
    return { unassigned: true };
  }

  /** The trainer a member is currently with, if any — drives the admin's person page. */
  async findAssignedTrainer(memberIdOrUserId: string, gymId: string) {
    const member =
      (await this.prisma.member.findFirst({ where: { id: memberIdOrUserId, gymId } })) ??
      (await this.prisma.member.findFirst({ where: { userId: memberIdOrUserId, gymId } }));
    if (!member) throw new NotFoundException('Member not found in this gym');

    const assignment = await this.prisma.trainerAssignment.findFirst({
      where: { memberId: member.id, gymId, isActive: true },
      include: {
        trainer: {
          select: {
            id: true,
            specializations: true,
            user: { select: { id: true, firstName: true, lastName: true, avatar: true, phone: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
    if (!assignment) return null;

    return {
      trainerId: assignment.trainer.id,
      specializations: assignment.trainer.specializations,
      assignedAt: assignment.assignedAt,
      ...assignment.trainer.user,
    };
  }

  async getPerformance(gymId: string) {
    const trainers = await this.prisma.trainer.findMany({
      where: { gymId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { memberAssignments: true } },
      },
    });
    return trainers.map((t) => ({
      id: t.id,
      name: `${t.user.firstName} ${t.user.lastName}`,
      assignedMembers: t._count.memberAssignments,
      rating: t.rating,
      experience: t.experience,
      hourlyRate: t.hourlyRate,
    }));
  }

  async getMyDashboardStats(userId: string, gymId: string) {
    const trainer = await this.prisma.trainer.findFirst({
      where: { userId, gymId },
      include: { user: { select: { firstName: true, lastName: true, email: true, avatar: true } } },
    });
    if (!trainer) return null;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);

    // Active assignments
    const [activeAssignments, allSessions, todaySessions, monthSessions, monthCompleted] = await Promise.all([
      this.prisma.trainerAssignment.findMany({
        where: { trainerId: trainer.id, gymId, isActive: true },
        include: { member: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } } },
      }),
      this.prisma.ptSession.findMany({
        where: { trainerId: trainer.id, gymId },
        include: { member: { include: { user: { select: { firstName: true, lastName: true, avatar: true } } } } },
        orderBy: { scheduledAt: 'desc' },
        take: 50,
      }),
      this.prisma.ptSession.count({ where: { trainerId: trainer.id, gymId, scheduledAt: { gte: todayStart, lte: todayEnd } } }),
      this.prisma.ptSession.count({ where: { trainerId: trainer.id, gymId, scheduledAt: { gte: monthStart, lte: monthEnd } } }),
      this.prisma.ptSession.count({ where: { trainerId: trainer.id, gymId, status: 'COMPLETED', completedAt: { gte: monthStart, lte: monthEnd } } }),
    ]);

    // Active PT clients = members with at least 1 SCHEDULED session
    const activePtClientIds = new Set(
      allSessions.filter(s => s.status === 'SCHEDULED').map(s => s.memberId),
    );

    // Monthly earnings = completed sessions this month * (hourlyRate * duration/60)
    const completedThisMonth = allSessions.filter(s =>
      s.status === 'COMPLETED' && s.completedAt && s.completedAt >= monthStart && s.completedAt <= monthEnd,
    );
    const monthlyEarnings = trainer.hourlyRate
      ? completedThisMonth.reduce((sum, s) => sum + (trainer.hourlyRate! * (s.duration / 60)), 0)
      : 0;

    // Attendance rate: % of trainer's clients who checked in at least once this month
    const memberIds = activeAssignments.map(a => a.memberId);
    let attendanceRate = 0;
    if (memberIds.length > 0) {
      const attendedCount = await this.prisma.attendance.groupBy({
        by: ['memberId'],
        where: { memberId: { in: memberIds }, gymId, checkInTime: { gte: monthStart, lte: monthEnd } },
      });
      attendanceRate = Math.round((attendedCount.length / memberIds.length) * 100);
    }

    // Member retention rate: % of assignments still active (proxy: active/total assignments ever)
    const totalAssignmentsEver = await this.prisma.trainerAssignment.count({ where: { trainerId: trainer.id, gymId } });
    const memberRetentionRate = totalAssignmentsEver > 0
      ? Math.round((activeAssignments.length / totalAssignmentsEver) * 100)
      : 100;

    // Transformation success rate: % of clients whose latest weight < their first weight
    let transformationSuccessRate = 0;
    if (memberIds.length > 0) {
      let successCount = 0;
      await Promise.all(memberIds.map(async (mId) => {
        const logs = await this.prisma.progressLog.findMany({
          where: { memberId: mId },
          orderBy: { logDate: 'asc' },
          select: { weight: true },
        });
        const withWeight = logs.filter(l => l.weight !== null);
        if (withWeight.length >= 2) {
          const first = withWeight[0].weight!;
          const last  = withWeight[withWeight.length - 1].weight!;
          if (last < first) successCount++;
        }
      }));
      transformationSuccessRate = memberIds.length > 0 ? Math.round((successCount / memberIds.length) * 100) : 0;
    }

    // Performance score: weighted average
    const completionRate = allSessions.length > 0
      ? Math.round((allSessions.filter(s => s.status === 'COMPLETED').length / allSessions.length) * 100)
      : 0;
    const ratingScore = trainer.rating ? (trainer.rating / 5) * 100 : 0;
    const performanceScore = Math.round(
      completionRate * 0.35 +
      ratingScore   * 0.30 +
      attendanceRate * 0.20 +
      (memberRetentionRate > 0 ? memberRetentionRate : 50) * 0.15,
    );

    // Chart data: last 6 months session counts + earnings
    const chartData = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const label = d.toLocaleDateString('en', { month: 'short' });
        return this.prisma.ptSession.count({
          where: { trainerId: trainer.id, gymId, scheduledAt: { gte: start, lte: end } },
        }).then(async (count) => {
          const completed = await this.prisma.ptSession.count({
            where: { trainerId: trainer.id, gymId, status: 'COMPLETED', completedAt: { gte: start, lte: end } },
          });
          const earnings = trainer.hourlyRate ? completed * trainer.hourlyRate : 0;
          return { month: label, sessions: count, completed, earnings };
        });
      }),
    );

    // Upcoming sessions (next 7 days)
    const next7Days = new Date(now); next7Days.setDate(now.getDate() + 7);
    const upcomingSessions = await this.prisma.ptSession.findMany({
      where: { trainerId: trainer.id, gymId, status: 'SCHEDULED', scheduledAt: { gte: now, lte: next7Days } },
      include: { member: { include: { user: { select: { firstName: true, lastName: true, avatar: true } } } } },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });

    // Notifications for trainer
    const notifications = await this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Recent activity (last 5 completed sessions)
    const recentActivity = allSessions.filter(s => s.status === 'COMPLETED').slice(0, 5);

    return {
      trainer: { ...trainer, user: trainer.user },
      performanceScore,
      totalAssignedMembers: activeAssignments.length,
      activePtClients: activePtClientIds.size,
      todaySessions,
      monthlyCompleted: monthCompleted,
      monthlySessions: monthSessions,
      monthlyEarnings: Math.round(monthlyEarnings),
      attendanceRate,
      memberRetentionRate,
      transformationSuccessRate,
      completionRate,
      chartData,
      upcomingSessions,
      recentActivity,
      notifications,
      assignedMembers: activeAssignments,
    };
  }
}
