import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { GymStatus } from '@prisma/client';
import { CreateGymDto } from './dto/create-gym.dto';
import { pickUpdatableGymFields, SetGymPlanDto, UpdateGymAdminDto, UpdateGymProfileDto } from './dto/update-gym.dto';

@Injectable()
export class GymsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(query: any) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [gyms, total] = await Promise.all([
      this.prisma.gym.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { members: true, trainers: true } },
        },
      }),
      this.prisma.gym.count({ where }),
    ]);

    return { data: gyms, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const gym = await this.prisma.gym.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { members: true, trainers: true } },
      },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    return gym;
  }

  async create(data: CreateGymDto) {
    return this.prisma.gym.create({ data: data as any });
  }

  /**
   * Update a gym's profile. `data` is already DTO-filtered by the global pipe;
   * it is filtered again here by role so a future `@Body() any` regression can't
   * reopen the privilege-escalation hole (saasPlan/saasStatus/saasExpiresAt are
   * not writable by anyone — subscriptions own those columns).
   */
  async update(id: string, data: UpdateGymProfileDto | UpdateGymAdminDto, user: any) {
    const gym = await this.prisma.gym.findFirst({ where: { id, deletedAt: null } });
    if (!gym) throw new NotFoundException('Gym not found');

    if (user.role === 'GYM_ADMIN' && user.gymId !== id) {
      throw new ForbiddenException('Not authorized');
    }

    const safeData = pickUpdatableGymFields(data as Record<string, unknown>, user.role);
    const updated = await this.prisma.gym.update({ where: { id }, data: safeData });

    await this.audit.log({
      gymId: id,
      userId: user.id,
      action: 'GYM_UPDATED',
      entity: 'Gym',
      entityId: id,
      oldValues: Object.fromEntries(Object.keys(safeData).map((k) => [k, (gym as any)[k]])),
      newValues: safeData,
    });

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.gym.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    return { message: 'Gym deleted successfully' };
  }

  async updateStatus(id: string, status: GymStatus) {
    await this.findOne(id);
    return this.prisma.gym.update({ where: { id }, data: { status } });
  }

  /**
   * Set a gym's SaaS tier. SUPER_ADMIN only and always audited — this is the one
   * sanctioned writer of the saas* columns, which is why they are stripped from
   * every other update path.
   */
  async setPlan(id: string, dto: SetGymPlanDto, user: any) {
    const gym = await this.findOne(id);
    const data: Record<string, unknown> = { saasPlan: dto.plan };
    if (dto.status) data.saasStatus = dto.status;
    if (dto.expiresAt) data.saasExpiresAt = new Date(dto.expiresAt);

    const updated = await this.prisma.gym.update({ where: { id }, data });

    await this.audit.log({
      gymId: id,
      userId: user?.id,
      action: 'GYM_PLAN_CHANGED',
      entity: 'Gym',
      entityId: id,
      oldValues: { saasPlan: gym.saasPlan, saasStatus: gym.saasStatus, saasExpiresAt: gym.saasExpiresAt },
      newValues: { ...data, reason: dto.reason },
    });

    return updated;
  }

  async getStats(gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalMembers, activeMembers, todayAttendance, monthlyRevenue, pendingPayments, openEnquiries, newEnquiriesToday] =
      await Promise.all([
        this.prisma.member.count({ where: { gymId, deletedAt: null } }),
        this.prisma.memberSubscription.count({ where: { gymId, status: 'ACTIVE' } }),
        this.prisma.attendance.count({ where: { gymId, checkInTime: { gte: today } } }),
        this.prisma.payment.aggregate({
          where: {
            gymId,
            status: 'COMPLETED',
            paidAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
          },
          _sum: { amount: true },
        }),
        this.prisma.payment.count({ where: { gymId, status: 'PENDING' } }),
        // Enquiries the front desk has taken and nobody has closed out. The
        // admin dashboard shows these so a walk-in logged by staff does not sit
        // unseen until someone opens the enquiries screen.
        this.prisma.enquiry.count({
          where: { gymId, deletedAt: null, status: { in: ['NEW', 'CONTACTED', 'INTERESTED'] } },
        }),
        this.prisma.enquiry.count({ where: { gymId, deletedAt: null, createdAt: { gte: today } } }),
      ]);

    return {
      totalMembers,
      activeMembers,
      todayAttendance,
      monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
      pendingPayments,
      openEnquiries,
      newEnquiriesToday,
    };
  }
}
