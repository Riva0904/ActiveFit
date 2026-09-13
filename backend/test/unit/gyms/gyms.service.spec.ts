import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GymsService } from '../../../src/gyms/gyms.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockGym = {
  id: 'gym-001',
  name: 'FitnessHub',
  email: 'info@fitnesshub.com',
  phone: '+91 9876543210',
  address: '123 St',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560001',
  status: 'ACTIVE',
  saasPlan: 'PROFESSIONAL',
  deletedAt: null,
  createdAt: new Date(),
};

const mockPrisma = {
  gym: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  member: { count: jest.fn() },
  memberSubscription: { count: jest.fn() },
  attendance: { count: jest.fn() },
  payment: { aggregate: jest.fn(), count: jest.fn() },
};

describe('GymsService', () => {
  let service: GymsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GymsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(GymsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated gyms, excluding soft-deleted', async () => {
      mockPrisma.gym.findMany.mockResolvedValue([mockGym]);
      mockPrisma.gym.count.mockResolvedValue(1);

      const result: any = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.gym.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
    });

    it('filters by status', async () => {
      mockPrisma.gym.findMany.mockResolvedValue([]);
      mockPrisma.gym.count.mockResolvedValue(0);
      await service.findAll({ status: 'PENDING' });
      expect(mockPrisma.gym.findMany.mock.calls[0][0].where.status).toBe('PENDING');
    });

    it('searches by name and city', async () => {
      mockPrisma.gym.findMany.mockResolvedValue([]);
      mockPrisma.gym.count.mockResolvedValue(0);
      await service.findAll({ search: 'fitness' });
      const where = mockPrisma.gym.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('returns the gym with member/trainer counts', async () => {
      mockPrisma.gym.findFirst.mockResolvedValue(mockGym);
      const result = await service.findOne('gym-001');
      expect(result).toEqual(mockGym);
      expect(mockPrisma.gym.findFirst.mock.calls[0][0].where).toEqual({ id: 'gym-001', deletedAt: null });
    });

    it('throws NotFoundException when missing or soft-deleted', async () => {
      mockPrisma.gym.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns the gym', async () => {
      mockPrisma.gym.create.mockResolvedValue(mockGym);
      await expect(service.create({ name: 'FitnessHub', email: 'x@x.com' })).resolves.toEqual(mockGym);
    });
  });

  describe('update', () => {
    it('lets SUPER_ADMIN update any gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(mockGym);
      mockPrisma.gym.update.mockResolvedValue({ ...mockGym, name: 'Updated' });

      await service.update('gym-001', { name: 'Updated' }, { role: 'SUPER_ADMIN', id: 'sa-001', gymId: null });

      expect(mockPrisma.gym.update).toHaveBeenCalledWith({ where: { id: 'gym-001' }, data: { name: 'Updated' } });
    });

    it('lets a GYM_ADMIN update their own gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(mockGym);
      mockPrisma.gym.update.mockResolvedValue(mockGym);
      await service.update('gym-001', {}, { role: 'GYM_ADMIN', id: 'admin-001', gymId: 'gym-001' });
      expect(mockPrisma.gym.update).toHaveBeenCalled();
    });

    it('throws ForbiddenException when a GYM_ADMIN targets another gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(mockGym);
      await expect(
        service.update('gym-001', {}, { role: 'GYM_ADMIN', id: 'admin-001', gymId: 'gym-OTHER' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.gym.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a non-existent gym', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue(null);
      await expect(service.update('bad', {}, { role: 'SUPER_ADMIN', id: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates the status', async () => {
      mockPrisma.gym.findFirst.mockResolvedValue(mockGym);
      mockPrisma.gym.update.mockResolvedValue({ ...mockGym, status: 'SUSPENDED' });
      await service.updateStatus('gym-001', 'SUSPENDED' as any);
      expect(mockPrisma.gym.update).toHaveBeenCalledWith({ where: { id: 'gym-001' }, data: { status: 'SUSPENDED' } });
    });
  });

  describe('remove', () => {
    it('soft-deletes (deletedAt + INACTIVE) instead of hard-deleting', async () => {
      mockPrisma.gym.findFirst.mockResolvedValue(mockGym);
      mockPrisma.gym.update.mockResolvedValue(mockGym);

      const res = await service.remove('gym-001');

      expect(mockPrisma.gym.update).toHaveBeenCalledWith({
        where: { id: 'gym-001' },
        data: { deletedAt: expect.any(Date), status: 'INACTIVE' },
      });
      expect(res.message).toContain('deleted');
    });

    it('throws NotFoundException for a non-existent gym', async () => {
      mockPrisma.gym.findFirst.mockResolvedValue(null);
      await expect(service.remove('bad')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.gym.update).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('returns gym statistics', async () => {
      mockPrisma.member.count.mockResolvedValue(150);
      mockPrisma.memberSubscription.count.mockResolvedValue(120);
      mockPrisma.attendance.count.mockResolvedValue(45);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 75000 } });
      mockPrisma.payment.count.mockResolvedValue(3);

      const result: any = await service.getStats('gym-001');

      expect(result).toEqual({ totalMembers: 150, activeMembers: 120, todayAttendance: 45, monthlyRevenue: 75000, pendingPayments: 3 });
      // totalMembers comes from Member (deletedAt: null), not a raw User count
      expect(mockPrisma.member.count).toHaveBeenCalledWith({ where: { gymId: 'gym-001', deletedAt: null } });
    });

    it('returns 0 revenue when there are no payments', async () => {
      mockPrisma.member.count.mockResolvedValue(0);
      mockPrisma.memberSubscription.count.mockResolvedValue(0);
      mockPrisma.attendance.count.mockResolvedValue(0);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrisma.payment.count.mockResolvedValue(0);

      const result: any = await service.getStats('gym-001');
      expect(result.monthlyRevenue).toBe(0);
    });
  });
});
