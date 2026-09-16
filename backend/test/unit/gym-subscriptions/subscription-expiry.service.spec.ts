import { Test } from '@nestjs/testing';
import { SubscriptionExpiryService } from '../../../src/gym-subscriptions/subscription-expiry.service';
import { GymSubscriptionsService } from '../../../src/gym-subscriptions/gym-subscriptions.service';
import { PlatformSettingsService } from '../../../src/platform-settings/platform-settings.service';
import { EntitlementsService } from '../../../src/entitlements/entitlements.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const DAY = 86_400_000;
const GYM = 'gym-001';

describe('SubscriptionExpiryService', () => {
  let prisma: any;
  let service: SubscriptionExpiryService;
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const platformSettings = { get: jest.fn() };
  const entitlements = { invalidate: jest.fn() };
  const subscriptions = { syncGymCache: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Zero grace: a plan goes inactive the day it expires.
    platformSettings.get.mockResolvedValue({ graceDays: 0, trialDays: 14 });

    prisma = {
      gymSubscription: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    const mod = await Test.createTestingModule({
      providers: [
        SubscriptionExpiryService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: PlatformSettingsService, useValue: platformSettings },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: GymSubscriptionsService, useValue: subscriptions },
      ],
    }).compile();
    service = mod.get(SubscriptionExpiryService);
  });

  describe('expiry', () => {
    it('expires a subscription the day it lapses when grace is zero', async () => {
      prisma.gymSubscription.findMany
        .mockResolvedValueOnce([{ id: 'sub-1', gymId: GYM }]) // lapsed
        .mockResolvedValueOnce([]); // reminders

      const res = await service.sweep();

      expect(res.expired).toBe(1);
      expect(prisma.gymSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub-1' }, data: { status: 'EXPIRED' } }),
      );
      expect(subscriptions.syncGymCache).toHaveBeenCalledWith(prisma, GYM);
      expect(entitlements.invalidate).toHaveBeenCalledWith(GYM);
    });

    it('uses the configured grace window as the cut-off', async () => {
      platformSettings.get.mockResolvedValue({ graceDays: 7 });
      prisma.gymSubscription.findMany.mockResolvedValue([]);

      await service.sweep();

      const cutoff = prisma.gymSubscription.findMany.mock.calls[0][0].where.endDate.lt as Date;
      const daysBack = (Date.now() - cutoff.getTime()) / DAY;
      expect(daysBack).toBeGreaterThan(6.9);
      expect(daysBack).toBeLessThan(7.1);
    });

    it('keeps going when one gym fails', async () => {
      prisma.gymSubscription.findMany
        .mockResolvedValueOnce([{ id: 'sub-1', gymId: 'a' }, { id: 'sub-2', gymId: 'b' }])
        .mockResolvedValueOnce([]);
      prisma.$transaction.mockRejectedValueOnce(new Error('db blip')).mockImplementation(async (cb: any) => cb(prisma));

      const res = await service.sweep();

      expect(res.expired).toBe(2); // both were attempted
      expect(entitlements.invalidate).toHaveBeenCalledWith('b');
    });
  });

  describe('the single 5-day reminder', () => {
    it('only looks at subscriptions that have not been reminded yet', async () => {
      prisma.gymSubscription.findMany.mockResolvedValue([]);

      await service.sweep();

      const where = prisma.gymSubscription.findMany.mock.calls[1][0].where;
      expect(where.expiryReminderSentAt).toBeNull();
      // Window is "not yet expired, but within 5 days".
      expect(where.endDate.gt).toBeInstanceOf(Date);
      const daysOut = (where.endDate.lte.getTime() - Date.now()) / DAY;
      expect(daysOut).toBeGreaterThan(4.9);
      expect(daysOut).toBeLessThan(6.1);
    });

    it('sends once and stamps the row so the next sweep skips it', async () => {
      const endDate = new Date(Date.now() + 5 * DAY);
      prisma.gymSubscription.findMany
        .mockResolvedValueOnce([]) // nothing lapsed
        .mockResolvedValueOnce([{ id: 'sub-1', gymId: GYM, endDate, plan: { name: 'Professional' } }]);

      const res = await service.sweep();

      expect(res.reminded).toBe(1);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', title: expect.stringContaining('expires in 5 days') }),
      );
      expect(prisma.gymSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub-1' }, data: { expiryReminderSentAt: expect.any(Date) } }),
      );
    });

    it('sends nothing on a second run because the query excludes stamped rows', async () => {
      prisma.gymSubscription.findMany.mockResolvedValue([]); // already-stamped rows do not come back

      const res = await service.sweep();

      expect(res.reminded).toBe(0);
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('says "1 day" not "1 days"', async () => {
      prisma.gymSubscription.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 's', gymId: GYM, endDate: new Date(Date.now() + 0.5 * DAY), plan: { name: 'Starter' } }]);

      await service.sweep();

      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('expires in 1 day') }),
      );
    });
  });
});
