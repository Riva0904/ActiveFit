import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { generateWorkoutPlan } from './ai-workout.generator';

@Injectable()
export class WorkoutPlansService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
    private entitlements: EntitlementsService,
  ) {}

  // ── Member's assigned workout plans ──────────────────────────────────────

  async findByUser(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) return [];

    return this.prisma.workoutAssignment.findMany({
      where: { memberId: member.id, gymId, isActive: true },
      include: { workoutPlan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateAiPlan(userId: string, gymId: string, goal: string, level: string, daysPerWeek?: number, equipment?: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    const generated = generateWorkoutPlan({ goal, level, daysPerWeek, equipment });
    const aiPlan = {
      name: generated.name,
      goal: generated.goal,
      difficulty: generated.difficulty,
      durationWeeks: generated.durationWeeks,
      description: generated.description,
      isAiGenerated: true,
      gymId,
      trainerId: null,
      exercises: generated.exercises as unknown as object[],
    };

    const plan = await this.prisma.workoutPlan.create({ data: aiPlan });

    if (member) {
      await this.prisma.workoutAssignment.create({
        data: {
          workoutPlanId: plan.id,
          memberId: member.id,
          gymId,
          startDate: new Date(),
          isActive: true,
        },
      });

      await this.notificationsService.create({
        userId: member.userId,
        gymId,
        title: 'Workout Plan Assigned',
        message: `Your AI workout plan "${plan.name}" is now active. Head to Workouts to see your schedule.`,
        type: 'GENERAL',
      });
    }

    return plan;
  }

  async findById(id: string, gymId: string) {
    const plan = await this.prisma.workoutPlan.findFirst({ where: { id, gymId } });
    if (!plan) throw new NotFoundException('Workout plan not found');
    return plan;
  }

  async update(id: string, data: any, gymId: string) {
    const plan = await this.prisma.workoutPlan.findFirst({ where: { id, gymId } });
    if (!plan) throw new NotFoundException('Workout plan not found');
    return this.prisma.workoutPlan.update({ where: { id }, data });
  }

  // ── Premium Workout Plan Packages ─────────────────────────────────────────

  async listPackages(gymId: string) {
    return (this.prisma.workoutPlan as any).findMany({
      where: { gymId, isPremium: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a workout plan. Premium plans are sold in the store and need the
   * PREMIUM_PACKAGES entitlement; plain plans are built for members on any tier.
   */
  async createPackage(data: any, gymId: string, trainerId?: string) {
    const isPremium = data.isPremium ?? true;
    if (isPremium) await this.entitlements.assertFeature(gymId, 'PREMIUM_PACKAGES');

    return (this.prisma.workoutPlan as any).create({
      data: {
        gymId,
        trainerId: trainerId ?? null,
        name: data.name,
        goal: data.goal ?? 'General',
        difficulty: data.difficulty ?? 'BEGINNER',
        durationWeeks: data.durationWeeks ?? 4,
        exercises: data.exercises ?? [],
        isPremium,
        price: isPremium ? data.price : null,
        durationDays: data.durationDays ?? 30,
        description: data.description ?? null,
        isTemplate: isPremium,
      },
    });
  }

  /** Gym-admin/trainer view: every plan in the gym, not only the sellable ones. */
  async listAll(gymId: string, query: { search?: string; premium?: string } = {}) {
    const where: any = { gymId, deletedAt: null };
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    if (query.premium === 'true') where.isPremium = true;
    if (query.premium === 'false') where.isPremium = false;

    return (this.prisma.workoutPlan as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { assignments: true } } },
    });
  }

  async softDelete(id: string, gymId: string) {
    const plan = await (this.prisma.workoutPlan as any).findFirst({ where: { id, gymId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Workout plan not found');
    await this.prisma.workoutAssignment.updateMany({ where: { workoutPlanId: id, gymId }, data: { isActive: false } });
    return (this.prisma.workoutPlan as any).update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Assign one plan to several members at once. */
  async assignToMembers(planId: string, memberIds: string[], gymId: string) {
    const plan: any = await (this.prisma.workoutPlan as any).findFirst({ where: { id: planId, gymId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Workout plan not found');

    const members = await this.prisma.member.findMany({
      where: { id: { in: memberIds }, gymId, deletedAt: null },
      select: { id: true },
    });
    if (members.length === 0) throw new NotFoundException('No matching members in this gym');

    const results = [];
    for (const member of members) {
      results.push(await this.assignPlanToMember(member.id, planId, gymId));
    }
    return { assigned: results.length, skipped: memberIds.length - results.length, assignments: results };
  }

  async listAssignments(planId: string, gymId: string) {
    return this.prisma.workoutAssignment.findMany({
      where: { workoutPlanId: planId, gymId, isActive: true },
      include: { member: { select: { id: true, memberCode: true, user: { select: { firstName: true, lastName: true, avatar: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unassign(assignmentId: string, gymId: string) {
    const assignment = await this.prisma.workoutAssignment.findFirst({ where: { id: assignmentId, gymId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return this.prisma.workoutAssignment.update({ where: { id: assignmentId }, data: { isActive: false } });
  }

  async updatePackage(id: string, data: any, gymId: string) {
    const plan = await (this.prisma.workoutPlan as any).findFirst({ where: { id, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Premium workout plan not found');
    const { name, goal, description, price, durationDays, durationWeeks, difficulty } = data;
    return (this.prisma.workoutPlan as any).update({ where: { id }, data: { name, goal, description, price, durationDays, durationWeeks, difficulty } });
  }

  async purchasePackage(planId: string, userId: string, gymId: string, useUpi = false) {
    const plan: any = await (this.prisma.workoutPlan as any).findFirst({ where: { id: planId, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Workout plan not found');
    if (!plan.price || plan.price <= 0) throw new ForbiddenException('This plan is not available for purchase');

    const orderResult = await this.paymentsService.createRazorpayOrder(plan.price, userId, gymId, 'WORKOUT_PLAN', undefined, undefined, undefined, useUpi);
    await (this.prisma.payment as any).update({ where: { id: orderResult.paymentId }, data: { workoutPlanId: planId } });

    return orderResult;
  }

  async assignPlanToMember(memberId: string, workoutPlanId: string, gymId: string) {
    const plan: any = await (this.prisma.workoutPlan as any).findFirst({ where: { id: workoutPlanId, gymId } });
    if (!plan) throw new NotFoundException('Workout plan not found');

    const assignment = await this.prisma.workoutAssignment.create({
      data: {
        workoutPlanId,
        memberId,
        gymId,
        startDate: new Date(),
        endDate: plan.durationDays ? new Date(Date.now() + plan.durationDays * 86400000) : undefined,
        isActive: true,
      },
    });

    const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { userId: true } });
    if (member) {
      await this.notificationsService.create({
        userId: member.userId,
        gymId,
        title: 'Workout Plan Assigned',
        message: `Your workout plan "${plan.name}" is now active. Head to Workouts to see your schedule.`,
        type: 'GENERAL',
      });
    }

    return assignment;
  }
}
