import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MembershipsService } from '../../../src/memberships/memberships.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const now = new Date();
const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const mockPlan = { id: 'plan-001', gymId: 'gym-001', name: 'Monthly Basic', type: 'MONTHLY', durationMonths: 1, price: 2000 };
const mockMember = { id: 'member-001', userId: 'user-001', gymId: 'gym-001' };
const mockSub = {
  id: 'sub-001',
  memberId: 'member-001',
  gymId: 'gym-001',
  planId: 'plan-001',
  status: 'ACTIVE',
  startDate: now,
  endDate: monthFromNow,
  amount: 2000,
  autoRenew: false,
  createdAt: now,
  updatedAt: now,
  plan: mockPlan,
  member: { ...mockMember, user: { id: 'user-001', firstName: 'John', lastName: 'Doe', email: 'j@x.com', phone: null, avatar: null } },
};

const mockPrisma = {
  memberSubscription: {
    findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(),
    update: jest.fn(), updateMany: jest.fn(), count: jest.fn(),
  },
  member: { findFirst: jest.fn() },
  membershipPlan: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
};

describe('MembershipsService', () => {
  let service: MembershipsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MembershipsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(MembershipsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated, flattened subscriptions for a gym', async () => {
      mockPrisma.memberSubscription.findMany.mockResolvedValue([mockSub]);
      mockPrisma.memberSubscription.count.mockResolvedValue(1);

      const result: any = await service.findAll({ page: 1, limit: 10 }, 'gym-001');

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({ id: 'sub-001', type: 'MONTHLY', user: { firstName: 'John' } });
      expect(mockPrisma.memberSubscription.findMany.mock.calls[0][0].where.gymId).toBe('gym-001');
    });

    it('filters by status', async () => {
      mockPrisma.memberSubscription.findMany.mockResolvedValue([]);
      mockPrisma.memberSubscription.count.mockResolvedValue(0);
      await service.findAll({ status: 'EXPIRED' }, 'gym-001');
      expect(mockPrisma.memberSubscription.findMany.mock.calls[0][0].where.status).toBe('EXPIRED');
    });

    it('resolves userId → memberId and returns empty when the user has no member profile', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      const result: any = await service.findAll({ userId: 'user-x' }, 'gym-001');
      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
      expect(mockPrisma.memberSubscription.findMany).not.toHaveBeenCalled();
    });

    it('scopes to the member when userId resolves', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.memberSubscription.findMany.mockResolvedValue([]);
      mockPrisma.memberSubscription.count.mockResolvedValue(0);
      await service.findAll({ userId: 'user-001' }, 'gym-001');
      expect(mockPrisma.memberSubscription.findMany.mock.calls[0][0].where.memberId).toBe('member-001');
    });
  });

  describe('findOne', () => {
    it('returns the subscription with plan and member.user', async () => {
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockSub);
      const result: any = await service.findOne('sub-001', 'sa', 'SUPER_ADMIN');
      expect(result.id).toBe('sub-001');
    });

    it('adds the gym filter for non-super-admin callers', async () => {
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockSub);
      await service.findOne('sub-001', 'admin', 'GYM_ADMIN', 'gym-001');
      expect(mockPrisma.memberSubscription.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'sub-001', gymId: 'gym-001' });
    });

    it('throws NotFoundException for an unknown id', async () => {
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad', 'sa', 'SUPER_ADMIN')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const base = { userId: 'user-001', gymId: 'gym-001', amount: 2000 };

    beforeEach(() => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(null); // no active sub yet
      mockPrisma.memberSubscription.create.mockResolvedValue(mockSub);
    });

    it('throws NotFoundException when the user is not a member of the gym', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.create({ ...base, planId: 'plan-001' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when an ACTIVE subscription already exists', async () => {
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockSub);
      await expect(service.create({ ...base, planId: 'plan-001' })).rejects.toThrow(ConflictException);
      expect(mockPrisma.memberSubscription.create).not.toHaveBeenCalled();
    });

    it('creates from an explicit planId and computes endDate from the plan type', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(mockPlan);
      const startDate = new Date('2026-01-15T00:00:00.000Z');

      await service.create({ ...base, planId: 'plan-001', startDate });

      const { data } = mockPrisma.memberSubscription.create.mock.calls[0][0];
      expect(data).toMatchObject({ memberId: 'member-001', gymId: 'gym-001', planId: 'plan-001', status: 'ACTIVE', amount: 2000 });
      expect(data.endDate.getMonth()).toBe((startDate.getMonth() + 1) % 12);
    });

    it('throws NotFoundException when the planId is not in this gym', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      await expect(service.create({ ...base, planId: 'plan-other' })).rejects.toThrow(NotFoundException);
    });

    it('auto-creates a plan for the gym when only `type` is given and none exists', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      mockPrisma.membershipPlan.create.mockResolvedValue({ ...mockPlan, id: 'plan-auto', type: 'QUARTERLY' });

      await service.create({ ...base, type: 'QUARTERLY' });

      expect(mockPrisma.membershipPlan.create.mock.calls[0][0].data).toMatchObject({ gymId: 'gym-001', type: 'QUARTERLY', durationMonths: 3, price: 2000 });
      expect(mockPrisma.memberSubscription.create.mock.calls[0][0].data.planId).toBe('plan-auto');
    });

    it('falls back to plan price when no amount is given', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ ...mockPlan, price: 1234 });
      await service.create({ userId: 'user-001', gymId: 'gym-001', planId: 'plan-001' });
      expect(mockPrisma.memberSubscription.create.mock.calls[0][0].data.amount).toBe(1234);
    });

    it('throws NotFoundException when neither planId nor type is given', async () => {
      await expect(service.create(base)).rejects.toThrow(NotFoundException);
    });
  });

  describe('renew', () => {
    it('extends a still-active MONTHLY subscription from its current endDate', async () => {
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockSub);
      mockPrisma.memberSubscription.update.mockResolvedValue(mockSub);

      await service.renew('sub-001', 'gym-001');

      const { data } = mockPrisma.memberSubscription.update.mock.calls[0][0];
      expect(data.status).toBe('ACTIVE');
      expect(data.startDate).toEqual(monthFromNow);
      const expected = new Date(monthFromNow); expected.setMonth(expected.getMonth() + 1);
      expect(data.endDate).toEqual(expected);
    });

    it('renews YEARLY by one year', async () => {
      mockPrisma.memberSubscription.findFirst.mockResolvedValue({ ...mockSub, plan: { ...mockPlan, type: 'YEARLY' } });
      mockPrisma.memberSubscription.update.mockResolvedValue(mockSub);
      await service.renew('sub-001', 'gym-001');
      const { data } = mockPrisma.memberSubscription.update.mock.calls[0][0];
      expect(data.endDate.getFullYear()).toBe(monthFromNow.getFullYear() + 1);
    });

    it('starts from today when the subscription already expired', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue({ ...mockSub, endDate: yesterday });
      mockPrisma.memberSubscription.update.mockResolvedValue(mockSub);
      await service.renew('sub-001', 'gym-001');
      const { data } = mockPrisma.memberSubscription.update.mock.calls[0][0];
      expect(data.startDate.getTime()).toBeGreaterThan(yesterday.getTime());
      expect(data.startDate.toDateString()).toBe(new Date().toDateString());
    });

    it('throws NotFoundException when the id is unknown / outside the caller gym', async () => {
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(null);
      await expect(service.renew('sub-001', 'gym-A')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activateFromPayment', () => {
    it('does nothing when the payer has no member profile', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await service.activateFromPayment('user-001', 'gym-001', 'plan-001', 2000);
      expect(mockPrisma.memberSubscription.update).not.toHaveBeenCalled();
      expect(mockPrisma.memberSubscription.create).not.toHaveBeenCalled();
    });

    it('extends the latest subscription when one exists (renew / switch plan)', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.membershipPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockSub);
      mockPrisma.memberSubscription.update.mockResolvedValue(mockSub);

      await service.activateFromPayment('user-001', 'gym-001', 'plan-001', 2000);

      const call = mockPrisma.memberSubscription.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'sub-001' });
      expect(call.data).toMatchObject({ planId: 'plan-001', status: 'ACTIVE', amount: 2000, startDate: monthFromNow });
    });

    it('creates the first subscription when none exists', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.membershipPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(null);
      mockPrisma.memberSubscription.create.mockResolvedValue(mockSub);

      await service.activateFromPayment('user-001', 'gym-001', 'plan-001', 2000);

      expect(mockPrisma.memberSubscription.create.mock.calls[0][0].data).toMatchObject({ memberId: 'member-001', gymId: 'gym-001', planId: 'plan-001', status: 'ACTIVE' });
    });
  });

  describe('getExpiringMembers', () => {
    it('returns ACTIVE subscriptions ending within N days', async () => {
      mockPrisma.memberSubscription.findMany.mockResolvedValue([mockSub]);
      const result: any = await service.getExpiringMembers('gym-001', 7);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'sub-001', type: 'MONTHLY', user: { firstName: 'John' } });
      const where = mockPrisma.memberSubscription.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ gymId: 'gym-001', status: 'ACTIVE' });
      expect(where.endDate.lte).toBeInstanceOf(Date);
    });
  });

  describe('checkExpiredMemberships (cron)', () => {
    it('flips every past-due ACTIVE subscription to EXPIRED', async () => {
      mockPrisma.memberSubscription.updateMany.mockResolvedValue({ count: 5 });
      await service.checkExpiredMemberships();
      expect(mockPrisma.memberSubscription.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', endDate: { lt: expect.any(Date) } },
        data: { status: 'EXPIRED' },
      });
    });
  });
});
