import { Test, TestingModule } from '@nestjs/testing';
import { DietPlansService } from '../../../src/diet-plans/diet-plans.service';
import { PaymentsService } from '../../../src/payments/payments.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const model = () => ({ findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() });
const prisma = { member: model(), dietPlan: model(), dietAssignment: model() };
const notifications = { create: jest.fn().mockResolvedValue({}) };

describe('DietPlansService', () => {
  let service: DietPlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DietPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get(DietPlansService);
    jest.clearAllMocks();
    prisma.dietPlan.create.mockImplementation(async ({ data }: any) => ({ id: 'dp-ai', ...data }));
    prisma.dietAssignment.create.mockResolvedValue({});
  });

  it('findByUser returns [] without a member profile, else active assignments', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.findByUser('user-001', 'gym-001')).resolves.toEqual([]);

    prisma.member.findFirst.mockResolvedValue({ id: 'member-001' });
    prisma.dietAssignment.findMany.mockResolvedValue([{ id: 'da1', dietPlan: {} }]);
    await expect(service.findByUser('user-001', 'gym-001')).resolves.toHaveLength(1);
    expect(prisma.dietAssignment.findMany.mock.calls[0][0].where).toEqual({ memberId: 'member-001', gymId: 'gym-001', isActive: true });
  });

  describe('generateAiDiet', () => {
    beforeEach(() => prisma.member.findFirst.mockResolvedValue({ id: 'member-001', userId: 'user-001' }));

    it('defaults to 4 meals at 2000 kcal, assigns the plan and notifies the member', async () => {
      const plan: any = await service.generateAiDiet('user-001', 'gym-001', 'WEIGHT_LOSS');

      expect(plan).toMatchObject({ name: 'AI WEIGHT LOSS Diet Plan', goal: 'WEIGHT_LOSS', totalCalories: 2000, isAiGenerated: true, gymId: 'gym-001', restrictions: ['NO_RESTRICTION'] });
      expect(plan.meals).toHaveLength(4);
      const total = plan.meals.reduce((s: number, m: any) => s + m.calories, 0);
      expect(Math.abs(total - 2000)).toBeLessThanOrEqual(plan.meals.length); // rounding slack
      expect(prisma.dietAssignment.create.mock.calls[0][0].data).toMatchObject({ dietPlanId: 'dp-ai', memberId: 'member-001', gymId: 'gym-001', isActive: true });
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-001', title: 'Diet Plan Assigned' }));
    });

    it('respects mealsPerDay within 3–6 and scales calories', async () => {
      const six: any = await service.generateAiDiet('user-001', 'gym-001', 'MUSCLE_GAIN', 3000, 'NO_RESTRICTION', 6);
      expect(six.meals).toHaveLength(6);
      expect(six.totalCalories).toBe(3000);
      const two: any = await service.generateAiDiet('user-001', 'gym-001', 'MUSCLE_GAIN', 3000, 'NO_RESTRICTION', 2);
      expect(two.meals).toHaveLength(3);
      const ten: any = await service.generateAiDiet('user-001', 'gym-001', 'MUSCLE_GAIN', 3000, 'NO_RESTRICTION', 10);
      expect(ten.meals).toHaveLength(6);
    });

    it.each([
      ['VEGAN', /oat milk|tofu|lentil/i, /chicken|fish|salmon|paneer|curd|\beggs?\b/i],
      ['VEGETARIAN', /paneer|dal|curd/i, /chicken|fish|salmon|bacon/i],
      ['KETO', /avocado|bacon|salmon/i, /\boats\b|brown rice|banana/i],
    ])('%s preference only pulls from the matching meal pool', async (pref, mustMatch, mustNotMatch) => {
      const plan: any = await service.generateAiDiet('user-001', 'gym-001', 'GENERAL', 2000, pref, 6);
      const items = plan.meals.flatMap((m: any) => m.items).join(' | ');
      expect(items).toMatch(mustMatch);
      expect(items).not.toMatch(mustNotMatch);
      expect(plan.restrictions[0]).toBe(pref);
    });

    it('records allergies alongside the preference', async () => {
      const plan: any = await service.generateAiDiet('user-001', 'gym-001', 'GENERAL', 2000, 'vegan', 4, 'peanuts');
      expect(plan.restrictions).toEqual(['VEGAN', 'peanuts']);
    });

    it('without a member profile the plan is created but not assigned', async () => {
      prisma.member.findFirst.mockResolvedValue(null);
      await service.generateAiDiet('user-001', 'gym-001', 'GENERAL');
      expect(prisma.dietPlan.create).toHaveBeenCalled();
      expect(prisma.dietAssignment.create).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
