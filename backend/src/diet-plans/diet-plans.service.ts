import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DietPlansService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
    private entitlements: EntitlementsService,
  ) {}

  // ── Member's assigned diet plans ──────────────────────────────────────────

  async findByUser(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) return [];

    return this.prisma.dietAssignment.findMany({
      where: { memberId: member.id, gymId, isActive: true },
      include: { dietPlan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateAiDiet(
    userId: string, gymId: string, goal: string, calories = 2000,
    dietaryPreference = 'NO_RESTRICTION', mealsPerDay = 4, allergies?: string,
  ) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    const pref = (dietaryPreference ?? 'NO_RESTRICTION').toUpperCase();
    const isVegan = pref === 'VEGAN';
    const isVegetarian = isVegan || pref === 'VEGETARIAN';
    const isKeto = pref === 'KETO';
    const n = Math.min(Math.max(Number(mealsPerDay) || 4, 3), 6);
    const cal = Number(calories) || 2000;

    // Meal templates keyed by preference
    const MEAL_POOLS: Record<string, { meal: string; items: string[]; ratio: number }[]> = {
      VEGAN: [
        { meal: 'Breakfast', items: ['Oats with oat milk', 'Mixed berries', 'Chia seeds', 'Banana'], ratio: 0.25 },
        { meal: 'Mid-Morning', items: ['Apple', 'Mixed nuts', 'Green smoothie'], ratio: 0.10 },
        { meal: 'Lunch', items: ['Brown rice', 'Lentil curry', 'Roasted vegetables', 'Salad'], ratio: 0.30 },
        { meal: 'Afternoon Snack', items: ['Hummus', 'Carrot sticks', 'Whole grain crackers'], ratio: 0.10 },
        { meal: 'Dinner', items: ['Quinoa', 'Chickpea curry', 'Steamed broccoli', 'Tofu'], ratio: 0.20 },
        { meal: 'Evening', items: ['Almond milk', 'Dates', 'Walnuts'], ratio: 0.05 },
      ],
      VEGETARIAN: [
        { meal: 'Breakfast', items: ['Oats with milk', 'Banana', 'Greek yogurt', 'Honey'], ratio: 0.25 },
        { meal: 'Mid-Morning', items: ['Paneer cubes', 'Apple', 'Mixed nuts'], ratio: 0.10 },
        { meal: 'Lunch', items: ['Brown rice', 'Dal', 'Paneer sabji', 'Salad'], ratio: 0.30 },
        { meal: 'Afternoon Snack', items: ['Curd', 'Fruits', 'Whole grain bread'], ratio: 0.10 },
        { meal: 'Dinner', items: ['Roti', 'Mixed vegetable curry', 'Rajma', 'Raita'], ratio: 0.20 },
        { meal: 'Evening', items: ['Milk', 'Almonds', 'Dates'], ratio: 0.05 },
      ],
      KETO: [
        { meal: 'Breakfast', items: ['3 Scrambled eggs', 'Avocado', 'Bacon', 'Butter coffee'], ratio: 0.25 },
        { meal: 'Mid-Morning', items: ['Cheese cubes', 'Walnuts', 'Celery with cream cheese'], ratio: 0.10 },
        { meal: 'Lunch', items: ['Grilled chicken breast', 'Leafy salad with olive oil', 'Avocado', 'Cheese'], ratio: 0.30 },
        { meal: 'Afternoon Snack', items: ['Boiled eggs', 'Almonds', 'Pork rinds'], ratio: 0.10 },
        { meal: 'Dinner', items: ['Grilled salmon', 'Roasted asparagus', 'Cauliflower rice', 'Butter'], ratio: 0.20 },
        { meal: 'Evening', items: ['Bone broth', 'Macadamia nuts'], ratio: 0.05 },
      ],
      DEFAULT: [
        { meal: 'Breakfast', items: ['Oats with milk', 'Banana', '2 Boiled eggs', 'Green tea'], ratio: 0.25 },
        { meal: 'Mid-Morning', items: ['Protein shake', 'Apple', 'Almonds'], ratio: 0.10 },
        { meal: 'Lunch', items: ['Brown rice', 'Grilled chicken', 'Mixed vegetables', 'Salad'], ratio: 0.30 },
        { meal: 'Afternoon Snack', items: ['Greek yogurt', 'Mixed berries', 'Walnuts'], ratio: 0.10 },
        { meal: 'Dinner', items: ['Grilled fish', 'Quinoa', 'Steamed broccoli', 'Olive oil'], ratio: 0.20 },
        { meal: 'Evening', items: ['Milk', 'Dates', 'Cashews'], ratio: 0.05 },
      ],
    };

    const poolKey = isVegan ? 'VEGAN' : isVegetarian ? 'VEGETARIAN' : isKeto ? 'KETO' : 'DEFAULT';
    const pool = MEAL_POOLS[poolKey];
    const selectedMeals = pool.slice(0, n);

    // Redistribute calories proportionally across selected meals
    const totalRatio = selectedMeals.reduce((s, m) => s + m.ratio, 0);
    const meals = selectedMeals.map((m) => ({
      meal: m.meal,
      items: m.items,
      calories: Math.round((m.ratio / totalRatio) * cal),
    }));

    const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const prefLabel = pref === 'NO_RESTRICTION' ? '' : `${titleCase(pref)} `;
    const aiPlan = {
      name: `${prefLabel}${titleCase(goal)} Diet Plan`,
      goal,
      totalCalories: cal,
      isAiGenerated: true,
      gymId,
      trainerId: null,
      meals,
      restrictions: [pref, ...(allergies ? [allergies] : [])],
    };
    const plan = await this.prisma.dietPlan.create({ data: aiPlan });

    if (member) {
      await this.prisma.dietAssignment.create({
        data: {
          dietPlanId: plan.id,
          memberId: member.id,
          gymId,
          startDate: new Date(),
          isActive: true,
        },
      });

      await this.notificationsService.create({
        userId: member.userId,
        gymId,
        title: 'Diet Plan Assigned',
        message: `Your AI diet plan "${plan.name}" is now active. Check the Diet Plans section to view your meals.`,
        type: 'GENERAL',
      });
    }

    return plan;
  }

  async findById(id: string, gymId: string) {
    const plan = await this.prisma.dietPlan.findFirst({ where: { id, gymId } });
    if (!plan) throw new NotFoundException('Diet plan not found');
    return plan;
  }

  // ── Premium Diet Plan Packages ────────────────────────────────────────────

  async listPackages(gymId: string) {
    return (this.prisma.dietPlan as any).findMany({
      where: { gymId, isPremium: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a diet plan. A premium plan is sold in the store and needs the
   * PREMIUM_PACKAGES entitlement; a plain plan is just built for members and is
   * available on every tier.
   */
  async createPackage(data: any, gymId: string, trainerId?: string) {
    const isPremium = data.isPremium ?? true;
    if (isPremium) await this.entitlements.assertFeature(gymId, 'PREMIUM_PACKAGES');

    return (this.prisma.dietPlan as any).create({
      data: {
        gymId,
        trainerId: trainerId ?? null,
        name: data.name,
        goal: data.goal ?? 'General',
        totalCalories: data.totalCalories ?? null,
        meals: data.meals ?? [],
        restrictions: data.restrictions ?? [],
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

    return (this.prisma.dietPlan as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { assignments: true } } },
    });
  }

  async updatePlan(id: string, data: any, gymId: string) {
    const plan = await (this.prisma.dietPlan as any).findFirst({ where: { id, gymId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Diet plan not found');
    return (this.prisma.dietPlan as any).update({ where: { id }, data });
  }

  async softDelete(id: string, gymId: string) {
    const plan = await (this.prisma.dietPlan as any).findFirst({ where: { id, gymId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Diet plan not found');
    await this.prisma.dietAssignment.updateMany({ where: { dietPlanId: id, gymId }, data: { isActive: false } });
    return (this.prisma.dietPlan as any).update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Assign one plan to several members at once; re-assigning refreshes the term. */
  async assignToMembers(planId: string, memberIds: string[], gymId: string) {
    const plan: any = await (this.prisma.dietPlan as any).findFirst({ where: { id: planId, gymId, deletedAt: null } });
    if (!plan) throw new NotFoundException('Diet plan not found');

    const members = await this.prisma.member.findMany({
      where: { id: { in: memberIds }, gymId, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (members.length === 0) throw new NotFoundException('No matching members in this gym');

    const results = [];
    for (const member of members) {
      results.push(await this.assignPlanToMember(member.id, planId, gymId));
    }
    return { assigned: results.length, skipped: memberIds.length - results.length, assignments: results };
  }

  async listAssignments(planId: string, gymId: string) {
    return this.prisma.dietAssignment.findMany({
      where: { dietPlanId: planId, gymId, isActive: true },
      include: { member: { select: { id: true, memberCode: true, user: { select: { firstName: true, lastName: true, avatar: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unassign(assignmentId: string, gymId: string) {
    const assignment = await this.prisma.dietAssignment.findFirst({ where: { id: assignmentId, gymId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return this.prisma.dietAssignment.update({ where: { id: assignmentId }, data: { isActive: false } });
  }

  async updatePackage(id: string, data: any, gymId: string) {
    const plan = await (this.prisma.dietPlan as any).findFirst({ where: { id, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Premium diet plan not found');
    const { name, goal, description, price, durationDays, totalCalories, restrictions } = data;
    return (this.prisma.dietPlan as any).update({ where: { id }, data: { name, goal, description, price, durationDays, totalCalories, restrictions } });
  }

  async purchasePackage(planId: string, userId: string, gymId: string, useUpi = false) {
    const plan: any = await (this.prisma.dietPlan as any).findFirst({ where: { id: planId, gymId, isPremium: true, deletedAt: null } });
    if (!plan) throw new NotFoundException('Diet plan not found');
    if (!plan.price || plan.price <= 0) throw new ForbiddenException('This plan is not available for purchase');

    const orderResult = await this.paymentsService.createRazorpayOrder(plan.price, userId, gymId, 'DIET_PLAN', undefined, undefined, undefined, useUpi);
    // Store dietPlanId on the payment for post-payment actions
    await (this.prisma.payment as any).update({ where: { id: orderResult.paymentId }, data: { dietPlanId: planId } });

    return orderResult;
  }

  async assignPlanToMember(memberId: string, dietPlanId: string, gymId: string) {
    const plan: any = await (this.prisma.dietPlan as any).findFirst({ where: { id: dietPlanId, gymId } });
    if (!plan) throw new NotFoundException('Diet plan not found');

    const assignment = await this.prisma.dietAssignment.create({
      data: {
        dietPlanId,
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
        title: 'Diet Plan Assigned',
        message: `Your diet plan "${plan.name}" is now active. Check the Diet Plans section to view your meals.`,
        type: 'GENERAL',
      });
    }

    return assignment;
  }
}
