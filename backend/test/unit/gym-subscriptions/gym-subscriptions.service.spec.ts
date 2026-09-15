import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GymSubscriptionsService } from '../../../src/gym-subscriptions/gym-subscriptions.service';
import { PlatformSettingsService } from '../../../src/platform-settings/platform-settings.service';
import { EntitlementsService } from '../../../src/entitlements/entitlements.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { AuditService } from '../../../src/common/services/audit.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { addMonths, addTerm, buildUpiIntentUrl, termStart } from '../../../src/gym-subscriptions/subscription-term';

const GYM = 'gym-001';
const USER = 'admin-001';
const DAY = 86_400_000;

const PRO = { id: 'plan-pro', plan: 'PROFESSIONAL', name: 'Professional', monthlyPrice: 7999, yearlyPrice: 79999, isActive: true };
const ENT = { id: 'plan-ent', plan: 'ENTERPRISE', name: 'Enterprise', monthlyPrice: 19999, yearlyPrice: 199999, isActive: true };

describe('subscription-term helpers', () => {
  it('addMonths clamps end-of-month instead of rolling over', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).getMonth()).toBe(1); // February, not March
    expect(addMonths(new Date('2026-03-15T00:00:00Z'), 1).getDate()).toBe(15);
  });

  it('addTerm handles monthly and yearly', () => {
    const from = new Date('2026-01-15T00:00:00Z');
    expect(addTerm(from, 'MONTHLY' as any).getMonth()).toBe(1);
    expect(addTerm(from, 'YEARLY' as any).getFullYear()).toBe(2027);
  });

  it('termStart stacks a renewal but starts a plan change immediately', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-20T00:00:00Z');
    expect(termStart(now, end, true).toISOString()).toBe(end.toISOString());   // renewal: keep remaining days
    expect(termStart(now, end, false).toISOString()).toBe(now.toISOString());  // upgrade: start now
    expect(termStart(now, new Date('2026-05-01T00:00:00Z'), true).toISOString()).toBe(now.toISOString()); // already lapsed
  });

  it('builds a UPI intent with the reference in the note', () => {
    const url = buildUpiIntentUrl({ vpa: 'ab@bank', payeeName: 'ActiveBoost', amount: 7999, note: 'AB-SUB-ABC123' });
    expect(url).toContain('pa=ab%40bank');
    expect(url).toContain('am=7999.00');
    expect(url).toContain('tn=AB-SUB-ABC123');
    expect(url).toContain('cu=INR');
  });
});

describe('GymSubscriptionsService', () => {
  let prisma: any;
  let service: GymSubscriptionsService;
  const audit = { log: jest.fn() };
  const notifications = { create: jest.fn() };
  const platformSettings = { get: jest.fn() };
  const entitlements = { invalidate: jest.fn(), getEntitlement: jest.fn(), getUsage: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    platformSettings.get.mockResolvedValue({ upiVpa: 'activeboost@bank', upiPayeeName: 'ActiveBoost', graceDays: 7 });

    prisma = {
      saaSSubscriptionPlan: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
      gymSubscriptionPayment: {
        findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(),
        update: jest.fn(), updateMany: jest.fn(), count: jest.fn(),
      },
      gymSubscription: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      gym: { findFirst: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([{ id: USER }]) },
      $transaction: jest.fn(),
    };
    // Run transactions against the same mock client.
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    const mod = await Test.createTestingModule({
      providers: [
        GymSubscriptionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: notifications },
        { provide: PlatformSettingsService, useValue: platformSettings },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();
    service = mod.get(GymSubscriptionsService);
  });

  describe('request', () => {
    beforeEach(() => {
      prisma.saaSSubscriptionPlan.findFirst.mockResolvedValue(PRO);
      prisma.gymSubscriptionPayment.findFirst.mockResolvedValue(null); // no open request, no code clash
      prisma.gymSubscriptionPayment.findUnique.mockResolvedValue(null);
      prisma.gymSubscriptionPayment.create.mockImplementation(async ({ data }: any) => ({ id: 'req-1', status: 'AWAITING_PAYMENT', ...data }));
    });

    it('prices monthly from the plan row and returns UPI details', async () => {
      const res: any = await service.request(GYM, USER, { planId: PRO.id, billingPeriod: 'MONTHLY' as any });

      expect(res.amount).toBe(7999);
      expect(res.vpa).toBe('activeboost@bank');
      expect(res.referenceCode).toMatch(/^AB-SUB-/);
      expect(res.upiIntentUrl).toContain('am=7999.00');
      expect(prisma.gymSubscriptionPayment.create.mock.calls[0][0].data.amount).toBe(7999);
    });

    it('prices yearly from the plan row', async () => {
      const res: any = await service.request(GYM, USER, { planId: PRO.id, billingPeriod: 'YEARLY' as any });
      expect(res.amount).toBe(79999);
    });

    it('ignores any amount the client tries to supply', async () => {
      await service.request(GYM, USER, { planId: PRO.id, billingPeriod: 'MONTHLY', amount: 1 } as any);
      expect(prisma.gymSubscriptionPayment.create.mock.calls[0][0].data.amount).toBe(7999);
    });

    it('snapshots the payee VPA on the row', async () => {
      await service.request(GYM, USER, { planId: PRO.id, billingPeriod: 'MONTHLY' as any });
      expect(prisma.gymSubscriptionPayment.create.mock.calls[0][0].data.payeeVpa).toBe('activeboost@bank');
    });

    it('refuses a second open request', async () => {
      prisma.gymSubscriptionPayment.findFirst.mockResolvedValue({ id: 'req-open', status: 'SUBMITTED' });
      await expect(service.request(GYM, USER, { planId: PRO.id, billingPeriod: 'MONTHLY' as any })).rejects.toThrow(ConflictException);
    });

    it('refuses when the platform has no UPI configured', async () => {
      platformSettings.get.mockResolvedValue({ upiVpa: null });
      await expect(service.request(GYM, USER, { planId: PRO.id, billingPeriod: 'MONTHLY' as any })).rejects.toThrow(BadRequestException);
    });

    it('404s on an unknown or inactive plan', async () => {
      prisma.saaSSubscriptionPlan.findFirst.mockResolvedValue(null);
      await expect(service.request(GYM, USER, { planId: 'nope', billingPeriod: 'MONTHLY' as any })).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaid', () => {
    it('moves the request to SUBMITTED with the UTR', async () => {
      prisma.gymSubscriptionPayment.findFirst.mockResolvedValue({ id: 'req-1', gymId: GYM, status: 'AWAITING_PAYMENT' });
      prisma.gymSubscriptionPayment.update.mockImplementation(async ({ data }: any) => ({ id: 'req-1', ...data }));

      const res: any = await service.markPaid(GYM, 'req-1', { upiReference: 'UTR123456' });

      expect(res.status).toBe('SUBMITTED');
      expect(res.upiReference).toBe('UTR123456');
      expect(res.submittedAt).toBeInstanceOf(Date);
    });

    it('404s for another gym’s request (tenant scoping)', async () => {
      prisma.gymSubscriptionPayment.findFirst.mockResolvedValue(null);
      await expect(service.markPaid('gym-OTHER', 'req-1', {})).rejects.toThrow(NotFoundException);
      expect(prisma.gymSubscriptionPayment.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'req-1', gymId: 'gym-OTHER' });
    });

    it('is a no-op once confirmed', async () => {
      prisma.gymSubscriptionPayment.findFirst.mockResolvedValue({ id: 'req-1', gymId: GYM, status: 'CONFIRMED' });
      await service.markPaid(GYM, 'req-1', {});
      expect(prisma.gymSubscriptionPayment.update).not.toHaveBeenCalled();
    });

    it('rejects a cancelled request', async () => {
      prisma.gymSubscriptionPayment.findFirst.mockResolvedValue({ id: 'req-1', gymId: GYM, status: 'CANCELLED' });
      await expect(service.markPaid(GYM, 'req-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm', () => {
    const submitted = { id: 'req-1', gymId: GYM, planId: PRO.id, billingPeriod: 'MONTHLY', amount: 7999, status: 'SUBMITTED', plan: PRO, notes: null };

    beforeEach(() => {
      prisma.gymSubscriptionPayment.findUnique.mockResolvedValue(submitted);
      prisma.gymSubscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
      prisma.gymSubscriptionPayment.update.mockResolvedValue({});
      prisma.gymSubscription.create.mockImplementation(async ({ data }: any) => ({ id: 'sub-1', ...data }));
      prisma.gymSubscription.update.mockResolvedValue({});
      prisma.gym.update.mockResolvedValue({});
      prisma.gymSubscription.findFirst.mockResolvedValue(null);
    });

    it('activates the plan and syncs the gym cache in the same transaction', async () => {
      // first findFirst = current subscription (none), second = syncGymCache lookup
      prisma.gymSubscription.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'sub-1', status: 'ACTIVE', endDate: new Date(Date.now() + 30 * DAY), plan: PRO });

      const sub: any = await service.confirm('req-1', {}, { id: 'sa-1' });

      expect(sub.status).toBe('ACTIVE');
      expect(sub.amount).toBe(7999);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.gym.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: GYM }, data: expect.objectContaining({ saasPlan: 'PROFESSIONAL', saasStatus: 'ACTIVE' }) }),
      );
      expect(entitlements.invalidate).toHaveBeenCalledWith(GYM);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SAAS_SUBSCRIPTION_CONFIRMED' }));
      expect(notifications.create).toHaveBeenCalled();
    });

    it('is idempotent — a second confirm creates no second term', async () => {
      prisma.gymSubscriptionPayment.findUnique.mockResolvedValue({ ...submitted, status: 'CONFIRMED' });
      await service.confirm('req-1', {}, { id: 'sa-1' });
      expect(prisma.gymSubscription.create).not.toHaveBeenCalled();
    });

    it('loses gracefully when another confirm claims the row first', async () => {
      prisma.gymSubscriptionPayment.updateMany.mockResolvedValue({ count: 0 });
      await service.confirm('req-1', {}, { id: 'sa-1' });
      expect(prisma.gymSubscription.create).not.toHaveBeenCalled();
    });

    it('a renewal stacks on the remaining term', async () => {
      const currentEnd = new Date(Date.now() + 10 * DAY);
      prisma.gymSubscription.findFirst
        .mockResolvedValueOnce({ id: 'sub-old', endDate: currentEnd, plan: PRO })
        .mockResolvedValueOnce({ id: 'sub-1', status: 'ACTIVE', endDate: currentEnd, plan: PRO });

      await service.confirm('req-1', {}, { id: 'sa-1' });

      const created = prisma.gymSubscription.create.mock.calls[0][0].data;
      expect(created.startDate.getTime()).toBe(currentEnd.getTime());
      expect(prisma.gymSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub-old' }, data: expect.objectContaining({ cancelReason: 'Renewed', supersededById: 'sub-1' }) }),
      );
    });

    it('an upgrade starts now and supersedes the old term', async () => {
      prisma.gymSubscriptionPayment.findUnique.mockResolvedValue({ ...submitted, planId: ENT.id, plan: ENT });
      const currentEnd = new Date(Date.now() + 10 * DAY);
      prisma.gymSubscription.findFirst
        .mockResolvedValueOnce({ id: 'sub-old', endDate: currentEnd, plan: PRO })
        .mockResolvedValueOnce({ id: 'sub-1', status: 'ACTIVE', endDate: currentEnd, plan: ENT });

      await service.confirm('req-1', {}, { id: 'sa-1' });

      const created = prisma.gymSubscription.create.mock.calls[0][0].data;
      expect(created.startDate.getTime()).toBeLessThan(currentEnd.getTime());
      expect(prisma.gymSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cancelReason: 'Superseded by a plan change' }) }),
      );
    });

    it('refuses to confirm a request that was never submitted', async () => {
      prisma.gymSubscriptionPayment.findUnique.mockResolvedValue({ ...submitted, status: 'AWAITING_PAYMENT' });
      await expect(service.confirm('req-1', {}, { id: 'sa-1' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('records the reason and leaves entitlements untouched', async () => {
      prisma.gymSubscriptionPayment.findUnique.mockResolvedValue({ id: 'req-1', gymId: GYM, status: 'SUBMITTED', plan: PRO });
      prisma.gymSubscriptionPayment.update.mockImplementation(async ({ data }: any) => ({ id: 'req-1', ...data }));

      const res: any = await service.reject('req-1', { reason: 'No transfer found' }, { id: 'sa-1' });

      expect(res.status).toBe('REJECTED');
      expect(res.rejectionReason).toBe('No transfer found');
      expect(prisma.gym.update).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SAAS_SUBSCRIPTION_REJECTED' }));
    });
  });

  describe('grant', () => {
    it('activates a free term and audits the reason', async () => {
      prisma.saaSSubscriptionPlan.findUnique.mockResolvedValue(ENT);
      prisma.gym.findFirst.mockResolvedValue({ id: GYM });
      prisma.gymSubscription.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'sub-1', status: 'ACTIVE', endDate: new Date(), plan: ENT });
      prisma.gymSubscription.create.mockImplementation(async ({ data }: any) => ({ id: 'sub-1', ...data }));
      prisma.gym.update.mockResolvedValue({});

      const sub: any = await service.grant(GYM, { planId: ENT.id, billingPeriod: 'MONTHLY' as any, months: 3, reason: 'Partner deal' }, { id: 'sa-1' });

      expect(sub.amount).toBe(0);
      expect(sub.source).toBe('SUPER_ADMIN_GRANT');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SAAS_SUBSCRIPTION_GRANTED' }));
      expect(entitlements.invalidate).toHaveBeenCalledWith(GYM);
    });

    it('404s on an unknown gym', async () => {
      prisma.saaSSubscriptionPlan.findUnique.mockResolvedValue(ENT);
      prisma.gym.findFirst.mockResolvedValue(null);
      await expect(service.grant(GYM, { planId: ENT.id, billingPeriod: 'MONTHLY' as any, reason: 'x' }, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncGymCache', () => {
    it('writes the live term to the gym columns', async () => {
      const end = new Date(Date.now() + 5 * DAY);
      prisma.gymSubscription.findFirst.mockResolvedValue({ status: 'ACTIVE', endDate: end, plan: ENT });

      await service.syncGymCache(prisma, GYM);

      expect(prisma.gym.update).toHaveBeenCalledWith({
        where: { id: GYM },
        data: { saasPlan: 'ENTERPRISE', saasStatus: 'ACTIVE', saasExpiresAt: end },
      });
    });

    it('marks expired but keeps the tier when nothing is live', async () => {
      prisma.gymSubscription.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ endDate: new Date('2026-01-01') });

      await service.syncGymCache(prisma, GYM);

      const data = prisma.gym.update.mock.calls[0][0].data;
      expect(data.saasStatus).toBe('EXPIRED');
      expect(data).not.toHaveProperty('saasPlan');
    });
  });

  describe('listPlansForGym', () => {
    it('hides commission and gateway ids from buyers', async () => {
      prisma.saaSSubscriptionPlan.findMany.mockResolvedValue([{ ...PRO, commissionPct: 12, razorpayPlanId: 'rp_1', maxMembers: 500 }]);

      const [plan]: any = await service.listPlansForGym();

      expect(plan).not.toHaveProperty('commissionPct');
      expect(plan).not.toHaveProperty('razorpayPlanId');
      expect(plan.maxMembers).toBe(500);
    });
  });
});
