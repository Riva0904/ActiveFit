import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RevenueService {
  constructor(private prisma: PrismaService) {}

  async getGymRevenueStats(gymId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [monthly, yearly, pending, byType] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { gymId, status: 'COMPLETED', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { gymId, status: 'COMPLETED', paidAt: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { gymId, status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['type'],
        where: { gymId, status: 'COMPLETED', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      monthlyRevenue: monthly._sum.amount ?? 0,
      yearlyRevenue: yearly._sum.amount ?? 0,
      pendingAmount: pending._sum.amount ?? 0,
      pendingCount: pending._count,
      byType: byType.map((t) => ({
        type: t.type,
        total: t._sum.amount ?? 0,
        count: t._count,
      })),
    };
  }

  async getMonthlyBreakdown(gymId: string, months = 6) {
    const now = new Date();
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString('en', { month: 'short', year: '2-digit' });

      const breakdown = await this.prisma.payment.groupBy({
        by: ['type'],
        where: { gymId, status: 'COMPLETED', paidAt: { gte: start, lt: end } },
        _sum: { amount: true },
      });

      const row: any = { month: label, total: 0 };
      for (const b of breakdown) {
        row[b.type.toLowerCase()] = b._sum.amount ?? 0;
        row.total += b._sum.amount ?? 0;
      }
      result.push(row);
    }
    return result;
  }

  async getPlatformRevenue() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [thisMonth, thisYear, allTime, byTier] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paidAt: { gte: startOfMonth } },
        _sum: { platformCommission: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED', paidAt: { gte: startOfYear } },
        _sum: { platformCommission: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { platformCommission: true },
      }),
      this.prisma.gymSubscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: { select: { name: true, commissionPct: true } } },
      }),
    ]);

    return {
      thisMonth: thisMonth._sum.platformCommission ?? 0,
      thisYear: thisYear._sum.platformCommission ?? 0,
      allTime: allTime._sum.platformCommission ?? 0,
      activeGyms: byTier.length,
    };
  }

  /**
   * Platform-wide totals for the super admin dashboard.
   *
   * Counted in the database, not in the app: the mobile Gyms screen used to sum
   * `gyms.length` and each gym's member count over the *first 100 gyms only*, so
   * every number was wrong once the platform passed 100.
   */
  async getPlatformStats() {
    const [totalGyms, activeGyms, totalUsers, usersByRole, subsByStatus] = await Promise.all([
      this.prisma.gym.count({ where: { deletedAt: null } }),
      this.prisma.gym.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { deletedAt: null, role: { not: 'SUPER_ADMIN' } } }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.gymSubscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const countFor = (rows: { _count: { _all: number } }[], key: string, field: string) =>
      (rows as any[]).find((r) => r[field] === key)?._count._all ?? 0;

    return {
      totalGyms,
      activeGyms,
      // Everyone who uses the app, platform operators excluded.
      totalUsers,
      usersByRole: {
        members: countFor(usersByRole as any, 'MEMBER', 'role'),
        trainers: countFor(usersByRole as any, 'TRAINER', 'role'),
        staff: countFor(usersByRole as any, 'STAFF', 'role'),
        gymAdmins: countFor(usersByRole as any, 'GYM_ADMIN', 'role'),
      },
      subscriptions: {
        active: countFor(subsByStatus as any, 'ACTIVE', 'status'),
        trial: countFor(subsByStatus as any, 'TRIAL', 'status'),
        expired: countFor(subsByStatus as any, 'EXPIRED', 'status'),
      },
    };
  }
}
