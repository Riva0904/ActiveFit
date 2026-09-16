import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalaryPayoutsService } from '../../../src/salary-payouts/salary-payouts.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const GYM = 'gym-001';

const mockPrisma: any = {
  user: { findMany: jest.fn() },
  salaryPayout: { create: jest.fn(), updateMany: jest.fn() },
  // The service hands Prisma an array of create promises; the mock just resolves them.
  $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
};

describe('SalaryPayoutsService.createBatch', () => {
  let service: SalaryPayoutsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SalaryPayoutsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(SalaryPayoutsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));
  });

  const run = (items: { userId: string; amount: number }[]) =>
    service.createBatch(GYM, { periodLabel: 'September 2026', items });

  it('creates one payout per person, each with its own amount', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    mockPrisma.salaryPayout.create
      .mockResolvedValueOnce({ id: 'p1', amount: 18000 })
      .mockResolvedValueOnce({ id: 'p2', amount: 12000 });

    const result = await service.createBatch(GYM, {
      periodLabel: 'September 2026',
      items: [{ userId: 'u1', amount: 18000 }, { userId: 'u2', amount: 12000 }],
    });

    expect(result.created).toBe(2);
    expect(result.total).toBe(30000);
    // Amounts must not be averaged or shared — each row keeps what was typed.
    expect(mockPrisma.salaryPayout.create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', amount: 18000, gymId: GYM });
    expect(mockPrisma.salaryPayout.create.mock.calls[1][0].data).toMatchObject({ userId: 'u2', amount: 12000 });
  });

  it('writes the whole run in one transaction', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.salaryPayout.create.mockResolvedValue({ id: 'p1', amount: 1 });
    await run([{ userId: 'u1', amount: 1 }]);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty run', async () => {
    await expect(run([])).rejects.toThrow(BadRequestException);
  });

  it.each([0, -5])('refuses an amount of %s', async (amount) => {
    await expect(run([{ userId: 'u1', amount }])).rejects.toThrow(BadRequestException);
    expect(mockPrisma.salaryPayout.create).not.toHaveBeenCalled();
  });

  it('refuses the same person twice, which would double-pay them', async () => {
    await expect(run([{ userId: 'u1', amount: 1 }, { userId: 'u1', amount: 2 }])).rejects.toThrow(BadRequestException);
  });

  // The lookup is filtered by gym and role, so a missing row means the id was
  // someone else's staff member — or a member, who is never on payroll.
  it('refuses anyone who is not trainer or staff in this gym', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    await expect(run([{ userId: 'u1', amount: 1 }, { userId: 'outsider', amount: 1 }])).rejects.toThrow(NotFoundException);
    expect(mockPrisma.salaryPayout.create).not.toHaveBeenCalled();
  });

  it('scopes the recipient check to the gym and to payable roles', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    mockPrisma.salaryPayout.create.mockResolvedValue({ id: 'p1', amount: 1 });
    await run([{ userId: 'u1', amount: 1 }]);
    expect(mockPrisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      gymId: GYM,
      role: { in: ['TRAINER', 'STAFF'] },
    });
  });
});

describe('SalaryPayoutsService.markManyPaid', () => {
  let service: SalaryPayoutsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SalaryPayoutsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(SalaryPayoutsService);
    jest.clearAllMocks();
  });

  it('only touches this gym’s pending rows', async () => {
    mockPrisma.salaryPayout.updateMany.mockResolvedValue({ count: 2 });
    const result = await service.markManyPaid(GYM, ['p1', 'p2']);

    expect(result).toEqual({ paid: 2 });
    expect(mockPrisma.salaryPayout.updateMany.mock.calls[0][0].where).toEqual({
      id: { in: ['p1', 'p2'] },
      gymId: GYM,
      status: 'PENDING',
    });
  });

  it('refuses an empty list', async () => {
    await expect(service.markManyPaid(GYM, [])).rejects.toThrow(BadRequestException);
  });
});
