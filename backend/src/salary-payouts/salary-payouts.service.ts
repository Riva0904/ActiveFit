import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalaryPayoutsService {
  constructor(private prisma: PrismaService) {}

  async create(gymId: string, data: { userId: string; amount: number; periodLabel: string; notes?: string }) {
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    const recipient = await this.prisma.user.findFirst({
      where: { id: data.userId, gymId, role: { in: ['TRAINER', 'STAFF'] } },
    });
    if (!recipient) throw new NotFoundException('Trainer/staff not found in this gym');

    return this.prisma.salaryPayout.create({
      data: {
        gymId,
        userId: data.userId,
        amount: data.amount,
        periodLabel: data.periodLabel,
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * One payroll run: several people, each with their own amount, created
   * together. All-or-nothing — a half-written run would leave the admin
   * guessing who still needs paying.
   */
  async createBatch(
    gymId: string,
    data: { periodLabel: string; notes?: string; items: { userId: string; amount: number }[] },
  ) {
    const items = data.items ?? [];
    if (items.length === 0) throw new BadRequestException('Add at least one person to the run');
    if (items.some((i) => !i.amount || i.amount <= 0)) {
      throw new BadRequestException('Every amount must be greater than zero');
    }
    const ids = items.map((i) => i.userId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('The same person appears twice in this run');

    const recipients = await this.prisma.user.findMany({
      where: { id: { in: ids }, gymId, role: { in: ['TRAINER', 'STAFF'] } },
      select: { id: true },
    });
    if (recipients.length !== ids.length) {
      throw new NotFoundException('One or more people are not trainers or staff in this gym');
    }

    const created = await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.salaryPayout.create({
          data: {
            gymId,
            userId: i.userId,
            amount: i.amount,
            periodLabel: data.periodLabel,
            notes: data.notes ?? null,
          },
        }),
      ),
    );

    return {
      created: created.length,
      total: created.reduce((sum, p) => sum + p.amount, 0),
      payouts: created,
    };
  }

  /** Marks a whole run paid in one go, ignoring any already-paid rows. */
  async markManyPaid(gymId: string, ids: string[]) {
    if (!ids?.length) throw new BadRequestException('Nothing to mark paid');
    const { count } = await this.prisma.salaryPayout.updateMany({
      where: { id: { in: ids }, gymId, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    });
    return { paid: count };
  }

  async findAllForGym(gymId: string, query: any) {
    const { page = 1, limit = 20, status, userId } = query;
    const where: any = { gymId };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      this.prisma.salaryPayout.findMany({
        where,
        skip: (page - 1) * limit,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, role: true, payoutUpiVpa: true } } },
      }),
      this.prisma.salaryPayout.count({ where }),
    ]);

    return { data, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findMine(userId: string) {
    return this.prisma.salaryPayout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markPaid(id: string, gymId: string) {
    const payout = await this.prisma.salaryPayout.findUnique({ where: { id } });
    if (!payout || payout.gymId !== gymId) throw new NotFoundException('Payout not found');
    if (payout.status === 'PAID') return payout;

    return this.prisma.salaryPayout.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }
}
