import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { DietPlansService } from '../../../src/diet-plans/diet-plans.service';
import { WorkoutPlansService } from '../../../src/workout-plans/workout-plans.service';
import { PaymentsService } from '../../../src/payments/payments.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { EntitlementsService } from '../../../src/entitlements/entitlements.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AssignPlanDto, CreateDietPlanDto } from '../../../src/diet-plans/dto/diet-plan.dto';
import { CreateWorkoutPlanDto } from '../../../src/workout-plans/dto/workout-plan.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
const validate = (metatype: any, body: any) => pipe.transform(body, { type: 'body', metatype });

const GYM = 'gym-001';

describe('CreateDietPlanDto', () => {
  const valid = {
    name: 'Cutting plan',
    goal: 'WEIGHT_LOSS',
    totalCalories: 1800,
    meals: [{ meal: 'Breakfast', items: ['Oats', 'Banana'], calories: 450 }],
  };

  it('accepts a built plan with meals', async () => {
    const out: any = await validate(CreateDietPlanDto, valid);
    expect(out.meals[0].items).toEqual(['Oats', 'Banana']);
  });

  it('rejects a meal that is not an object of the right shape', async () => {
    await expect(validate(CreateDietPlanDto, { ...valid, meals: [{ items: ['x'] }] })).rejects.toThrow(BadRequestException);
    await expect(validate(CreateDietPlanDto, { ...valid, meals: [{ meal: 'B', items: 'not-an-array' }] })).rejects.toThrow(BadRequestException);
    await expect(validate(CreateDietPlanDto, { ...valid, meals: [{ meal: 'B', items: ['x'], calories: -5 }] })).rejects.toThrow(BadRequestException);
  });

  it('rejects injected fields that belong to the server', async () => {
    for (const field of ['gymId', 'isTemplate', 'trainerId', 'id', 'deletedAt']) {
      await expect(validate(CreateDietPlanDto, { ...valid, [field]: 'x' })).rejects.toThrow(BadRequestException);
    }
  });

  it('allows a plain (non-premium) plan with no price', async () => {
    const out: any = await validate(CreateDietPlanDto, { ...valid, isPremium: false });
    expect(out.isPremium).toBe(false);
  });
});

describe('CreateWorkoutPlanDto', () => {
  const valid = {
    name: 'Push Pull Legs',
    difficulty: 'INTERMEDIATE',
    exercises: [{ day: 'Monday', name: 'Bench Press', sets: 4, reps: '8-10', rest: 90, muscle: 'chest' }],
  };

  it('accepts a built plan', async () => {
    const out: any = await validate(CreateWorkoutPlanDto, valid);
    expect(out.exercises[0].day).toBe('Monday');
  });

  // The mobile detail screen filters by full weekday name — "Mon" silently
  // renders as a rest day, so the DTO refuses it.
  it('rejects a day that is not a full weekday name', async () => {
    await expect(validate(CreateWorkoutPlanDto, { ...valid, exercises: [{ ...valid.exercises[0], day: 'Mon' }] })).rejects.toThrow(BadRequestException);
    await expect(validate(CreateWorkoutPlanDto, { ...valid, exercises: [{ ...valid.exercises[0], day: 'Funday' }] })).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown difficulty and a zero-set exercise', async () => {
    await expect(validate(CreateWorkoutPlanDto, { ...valid, difficulty: 'GODLIKE' })).rejects.toThrow(BadRequestException);
    await expect(validate(CreateWorkoutPlanDto, { ...valid, exercises: [{ ...valid.exercises[0], sets: 0 }] })).rejects.toThrow(BadRequestException);
  });

  it('accepts reps as a number or a prescription string', async () => {
    await expect(validate(CreateWorkoutPlanDto, { ...valid, exercises: [{ ...valid.exercises[0], reps: 12 }] })).resolves.toBeDefined();
    await expect(validate(CreateWorkoutPlanDto, { ...valid, exercises: [{ ...valid.exercises[0], reps: '45s hold' }] })).resolves.toBeDefined();
  });
});

describe('AssignPlanDto', () => {
  it('needs at least one member id', async () => {
    await expect(validate(AssignPlanDto, { memberIds: [] })).rejects.toThrow(BadRequestException);
    await expect(validate(AssignPlanDto, { memberIds: ['m1', 'm2'] })).resolves.toMatchObject({ memberIds: ['m1', 'm2'] });
  });

  it('rejects a smuggled gymId', async () => {
    await expect(validate(AssignPlanDto, { memberIds: ['m1'], gymId: 'other' })).rejects.toThrow(BadRequestException);
  });
});

describe('DietPlansService — builder and assignment', () => {
  const model = () => ({ findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() });
  const prisma: any = { member: model(), dietPlan: model(), dietAssignment: model() };
  const entitlements = { assertFeature: jest.fn().mockResolvedValue(undefined) };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  let service: DietPlansService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        DietPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: PaymentsService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = mod.get(DietPlansService);
  });

  it('a plain plan skips the premium entitlement check and stores no price', async () => {
    prisma.dietPlan.create.mockImplementation(async ({ data }: any) => ({ id: 'dp-1', ...data }));

    const plan: any = await service.createPackage({ name: 'Custom', meals: [], isPremium: false, price: 999 }, GYM);

    expect(entitlements.assertFeature).not.toHaveBeenCalled();
    expect(plan.isPremium).toBe(false);
    expect(plan.price).toBeNull();
    expect(plan.isTemplate).toBe(false);
  });

  it('a premium plan still requires the entitlement', async () => {
    prisma.dietPlan.create.mockImplementation(async ({ data }: any) => ({ id: 'dp-1', ...data }));
    await service.createPackage({ name: 'Sellable', meals: [], isPremium: true, price: 999 }, GYM);
    expect(entitlements.assertFeature).toHaveBeenCalledWith(GYM, 'PREMIUM_PACKAGES');
  });

  describe('assignToMembers', () => {
    beforeEach(() => {
      prisma.dietPlan.findFirst.mockResolvedValue({ id: 'dp-1', name: 'Cutting', durationDays: 30 });
      prisma.dietAssignment.create.mockImplementation(async ({ data }: any) => ({ id: 'da-1', ...data }));
      prisma.member.findUnique.mockResolvedValue({ userId: 'u1' });
    });

    it('assigns every matching member and notifies them', async () => {
      prisma.member.findMany.mockResolvedValue([{ id: 'm1', userId: 'u1' }, { id: 'm2', userId: 'u2' }]);

      const res: any = await service.assignToMembers('dp-1', ['m1', 'm2'], GYM);

      expect(res.assigned).toBe(2);
      expect(prisma.dietAssignment.create).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenCalledTimes(2);
    });

    it('silently drops ids from another gym and reports them as skipped', async () => {
      prisma.member.findMany.mockResolvedValue([{ id: 'm1', userId: 'u1' }]);

      const res: any = await service.assignToMembers('dp-1', ['m1', 'intruder'], GYM);

      expect(res.assigned).toBe(1);
      expect(res.skipped).toBe(1);
      expect(prisma.member.findMany.mock.calls[0][0].where.gymId).toBe(GYM);
    });

    it('404s when the plan is not in this gym', async () => {
      prisma.dietPlan.findFirst.mockResolvedValue(null);
      await expect(service.assignToMembers('dp-other', ['m1'], GYM)).rejects.toThrow(NotFoundException);
    });

    it('404s when no id resolves to a member of this gym', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      await expect(service.assignToMembers('dp-1', ['ghost'], GYM)).rejects.toThrow(NotFoundException);
    });
  });

  it('soft delete also deactivates the assignments', async () => {
    prisma.dietPlan.findFirst.mockResolvedValue({ id: 'dp-1' });
    prisma.dietPlan.update.mockResolvedValue({});
    prisma.dietAssignment.updateMany.mockResolvedValue({ count: 3 });

    await service.softDelete('dp-1', GYM);

    expect(prisma.dietAssignment.updateMany).toHaveBeenCalledWith({ where: { dietPlanId: 'dp-1', gymId: GYM }, data: { isActive: false } });
    expect(prisma.dietPlan.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('unassign is scoped to the gym', async () => {
    prisma.dietAssignment.findFirst.mockResolvedValue(null);
    await expect(service.unassign('da-1', GYM)).rejects.toThrow(NotFoundException);
    expect(prisma.dietAssignment.findFirst.mock.calls[0][0].where).toEqual({ id: 'da-1', gymId: GYM });
  });
});

describe('WorkoutPlansService — builder and assignment', () => {
  const model = () => ({ findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() });
  const prisma: any = { member: model(), workoutPlan: model(), workoutAssignment: model() };
  const entitlements = { assertFeature: jest.fn().mockResolvedValue(undefined) };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  let service: WorkoutPlansService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        WorkoutPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: PaymentsService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = mod.get(WorkoutPlansService);
  });

  it('assigns a plan to several members', async () => {
    prisma.workoutPlan.findFirst.mockResolvedValue({ id: 'wp-1', name: 'PPL', durationDays: 30 });
    prisma.member.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    prisma.workoutAssignment.create.mockImplementation(async ({ data }: any) => ({ id: 'wa', ...data }));
    prisma.member.findUnique.mockResolvedValue({ userId: 'u1' });

    const res: any = await service.assignToMembers('wp-1', ['m1', 'm2'], GYM);

    expect(res.assigned).toBe(2);
    expect(prisma.workoutAssignment.create.mock.calls[0][0].data).toMatchObject({ workoutPlanId: 'wp-1', gymId: GYM, isActive: true });
  });

  it('a plain plan does not need the premium entitlement', async () => {
    prisma.workoutPlan.create.mockImplementation(async ({ data }: any) => ({ id: 'wp-1', ...data }));
    await service.createPackage({ name: 'Custom', exercises: [], isPremium: false }, GYM);
    expect(entitlements.assertFeature).not.toHaveBeenCalled();
  });
});
