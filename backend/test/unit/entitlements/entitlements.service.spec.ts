import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntitlementsService } from '../../../src/entitlements/entitlements.service';
import { PlatformSettingsService } from '../../../src/platform-settings/platform-settings.service';
import { SaasPlansService } from '../../../src/saas-plans/saas-plans.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const GYM = 'gym-001';
const DAY = 86_400_000;

const PLANS = [
  { plan: 'STARTER', maxMembers: 100, maxTrainers: 3, maxStaff: 2, maxBranches: 1 },
  { plan: 'PROFESSIONAL', maxMembers: 500, maxTrainers: 10, maxStaff: 5, maxBranches: 3 },
  { plan: 'ENTERPRISE', maxMembers: 9999, maxTrainers: 50, maxStaff: 20, maxBranches: 10 },
];

function planRow(plan: string) {
  const p = PLANS.find((x) => x.plan === plan)!;
  return { plan, maxMembers: p.maxMembers, maxTrainers: p.maxTrainers, maxStaff: p.maxStaff, maxBranches: p.maxBranches };
}

describe('EntitlementsService', () => {
  const prisma = {
    gymSubscription: { findFirst: jest.fn() },
    gym: { findUnique: jest.fn() },
    member: { count: jest.fn() },
    trainer: { count: jest.fn() },
    staff: { count: jest.fn() },
    branch: { count: jest.fn() },
  };
  const saasPlans = { findAll: jest.fn().mockResolvedValue(PLANS) };
  const platformSettings = { get: jest.fn().mockResolvedValue({ graceDays: 7, trialDays: 14 }) };
  let config: { get: jest.Mock };
  let service: EntitlementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    saasPlans.findAll.mockResolvedValue(PLANS);
    platformSettings.get.mockResolvedValue({ graceDays: 7, trialDays: 14 });
    prisma.member.count.mockResolvedValue(0);
    prisma.trainer.count.mockResolvedValue(0);
    prisma.staff.count.mockResolvedValue(0);
    prisma.branch.count.mockResolvedValue(0);
    config = { get: jest.fn().mockReturnValue('true') }; // feature enforcement on unless overridden

    const mod = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SaasPlansService, useValue: saasPlans },
        { provide: PlatformSettingsService, useValue: platformSettings },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = mod.get(EntitlementsService);
  });

  describe('resolution order', () => {
    it('prefers the subscription row over the denormalized gym columns', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() + 30 * DAY), plan: planRow('ENTERPRISE'),
      });
      prisma.gym.findUnique.mockResolvedValue({ saasPlan: 'STARTER', saasStatus: 'ACTIVE', saasExpiresAt: null });

      const e = await service.getEntitlement(GYM);

      expect(e.plan).toBe('ENTERPRISE');
      expect(e.limits.maxMembers).toBe(9999);
      expect(prisma.gym.findUnique).not.toHaveBeenCalled();
    });

    // Every gym in production predates subscriptions — without this fallback
    // they would all be downgraded on deploy.
    it('falls back to the gym columns when no subscription row exists', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue(null);
      prisma.gym.findUnique.mockResolvedValue({ saasPlan: 'PROFESSIONAL', saasStatus: 'ACTIVE', saasExpiresAt: null });

      const e = await service.getEntitlement(GYM);

      expect(e.plan).toBe('PROFESSIONAL');
      expect(e.limits.maxMembers).toBe(500);
      expect(e.isActive).toBe(true);
    });

    it('defaults to STARTER/TRIAL for an unknown gym', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue(null);
      prisma.gym.findUnique.mockResolvedValue(null);

      const e = await service.getEntitlement(GYM);
      expect(e.plan).toBe('STARTER');
      expect(e.status).toBe('TRIAL');
    });
  });

  describe('lazy expiry and grace', () => {
    it('reports EXPIRED when endDate has passed even though the row still says ACTIVE', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() - 2 * DAY), plan: planRow('PROFESSIONAL'),
      });

      const e = await service.getEntitlement(GYM);

      expect(e.status).toBe('EXPIRED');
      expect(e.inGrace).toBe(true);   // 2 days past, grace is 7
      expect(e.isActive).toBe(true);  // still usable during grace
    });

    it('drops out of grace after graceDays', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() - 9 * DAY), plan: planRow('PROFESSIONAL'),
      });

      const e = await service.getEntitlement(GYM);

      expect(e.inGrace).toBe(false);
      expect(e.isActive).toBe(false);
    });

    it('honours a configured grace of zero', async () => {
      platformSettings.get.mockResolvedValue({ graceDays: 0 });
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() - 60_000), plan: planRow('STARTER'),
      });

      const e = await service.getEntitlement(GYM);
      expect(e.isActive).toBe(false);
    });

    it('assertActive throws only once past grace', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() - 2 * DAY), plan: planRow('STARTER'),
      });
      await expect(service.assertActive(GYM)).resolves.toBeUndefined();

      service.invalidate();
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() - 30 * DAY), plan: planRow('STARTER'),
      });
      await expect(service.assertActive(GYM)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('limits', () => {
    beforeEach(() => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() + 30 * DAY), plan: planRow('STARTER'),
      });
    });

    it('allows the last slot and blocks the one after, with the legacy message', async () => {
      prisma.member.count.mockResolvedValue(99);
      await expect(service.assertWithinLimit(GYM, 'members')).resolves.toBeUndefined();

      prisma.member.count.mockResolvedValue(100);
      await expect(service.assertWithinLimit(GYM, 'members')).rejects.toThrow(
        'Your STARTER plan allows a maximum of 100 members. Please upgrade your plan.',
      );
      await expect(service.assertWithinLimit(GYM, 'members')).rejects.toThrow(BadRequestException);
    });

    it('uses the right noun and cap per resource', async () => {
      prisma.trainer.count.mockResolvedValue(3);
      await expect(service.assertWithinLimit(GYM, 'trainers')).rejects.toThrow(/maximum of 3 trainers/);

      prisma.staff.count.mockResolvedValue(2);
      await expect(service.assertWithinLimit(GYM, 'staff')).rejects.toThrow(/maximum of 2 staff members/);

      prisma.branch.count.mockResolvedValue(1);
      await expect(service.assertWithinLimit(GYM, 'branches')).rejects.toThrow(/maximum of 1 branches/);
    });

    it('never caches usage counts — a second call re-reads the database', async () => {
      prisma.member.count.mockResolvedValue(10);
      await service.assertWithinLimit(GYM, 'members');
      await service.assertWithinLimit(GYM, 'members');
      expect(prisma.member.count).toHaveBeenCalledTimes(2);
    });

    it('does not block when a tier has no cap configured', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() + DAY), plan: { plan: 'STARTER', maxMembers: 0, maxTrainers: 0, maxStaff: 0, maxBranches: 0 },
      });
      prisma.member.count.mockResolvedValue(9999);
      await expect(service.assertWithinLimit(GYM, 'members')).resolves.toBeUndefined();
    });
  });

  describe('features', () => {
    const active = (plan: string) => ({ status: 'ACTIVE', endDate: new Date(Date.now() + DAY), plan: planRow(plan) });

    it.each([
      ['STARTER', false],
      ['PROFESSIONAL', true],
      ['ENTERPRISE', true],
    ])('%s expenses access = %s', async (plan, expected) => {
      prisma.gymSubscription.findFirst.mockResolvedValue(active(plan));
      await expect(service.hasFeature(GYM, 'EXPENSES')).resolves.toBe(expected);
    });

    it('assertFeature names the feature in the error', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue(active('STARTER'));
      await expect(service.assertFeature(GYM, 'PAYROLL')).rejects.toThrow(/payroll/i);
    });

    it('an expired gym past grace has no features', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() - 30 * DAY), plan: planRow('ENTERPRISE'),
      });
      await expect(service.hasFeature(GYM, 'EXPENSES')).resolves.toBe(false);
    });

    it('with enforcement off, new gates open but the pre-existing premium gate stays shut', async () => {
      config.get.mockReturnValue('false');
      prisma.gymSubscription.findFirst.mockResolvedValue(active('STARTER'));

      await expect(service.hasFeature(GYM, 'EXPENSES')).resolves.toBe(true);
      // PREMIUM_PACKAGES blocked STARTER before entitlements existed — turning
      // the flag off must not hand starter gyms a capability they never had.
      await expect(service.hasFeature(GYM, 'PREMIUM_PACKAGES')).resolves.toBe(false);
    });
  });

  describe('caching', () => {
    it('caches the entitlement and re-reads after invalidate', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() + DAY), plan: planRow('STARTER'),
      });

      await service.getEntitlement(GYM);
      await service.getEntitlement(GYM);
      expect(prisma.gymSubscription.findFirst).toHaveBeenCalledTimes(1);

      service.invalidate(GYM);
      await service.getEntitlement(GYM);
      expect(prisma.gymSubscription.findFirst).toHaveBeenCalledTimes(2);
    });

    it('caches per gym', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValue({
        status: 'ACTIVE', endDate: new Date(Date.now() + DAY), plan: planRow('STARTER'),
      });
      await service.getEntitlement('gym-a');
      await service.getEntitlement('gym-b');
      expect(prisma.gymSubscription.findFirst).toHaveBeenCalledTimes(2);
    });
  });
});
