import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../../src/users/users.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EmailService } from '../../../src/email/email.service';
import { AuditService } from '../../../src/common/services/audit.service';
import { EntitlementsService } from '../../../src/entitlements/entitlements.service';

const OWN_GYM = 'gym-own';

const mockPrisma: any = {
  user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
  member: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
  trainer: { create: jest.fn() },
  staff: { create: jest.fn() },
  gym: { findUnique: jest.fn().mockResolvedValue({ name: 'FitnessHub' }) },
  $transaction: jest.fn(),
};

const permissive = {
  assertWithinLimit: jest.fn().mockResolvedValue(undefined),
  assertFeature: jest.fn().mockResolvedValue(undefined),
  hasFeature: jest.fn().mockResolvedValue(true),
  assertActive: jest.fn().mockResolvedValue(undefined),
  getEntitlement: jest.fn().mockResolvedValue({ plan: 'PROFESSIONAL', isActive: true, features: new Set(), limits: {} }),
  getUsage: jest.fn().mockResolvedValue({ members: 0, trainers: 0, staff: 0, branches: 0 }),
  invalidate: jest.fn(),
};

describe('who may create which account', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: EmailService,
          useValue: {
            sendAccountCreatedEmail: jest.fn().mockResolvedValue(undefined),
            sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: EntitlementsService, useValue: permissive },
      ],
    }).compile();
    service = module.get(UsersService);
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    // Every allowed path reaches the transaction; stub it so the assertion is
    // about the role rules, not about Prisma.
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        user: { create: jest.fn().mockResolvedValue({ id: 'new-user', email: 'x@y.com', role: 'MEMBER' }) },
        member: { create: jest.fn().mockResolvedValue({ memberCode: 'M001' }), count: jest.fn().mockResolvedValue(0) },
        trainer: { create: jest.fn().mockResolvedValue({}) },
        staff: { create: jest.fn().mockResolvedValue({}) },
        gym: { findUnique: jest.fn().mockResolvedValue({ id: OWN_GYM }) },
      }),
    );
  });

  const create = (role: string, creator: string) =>
    service.createUser(
      { firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'Password@123', role },
      creator,
      OWN_GYM,
    );

  // Front desk signs people up, which is the whole point of the role.
  it.each(['MEMBER', 'TRAINER'])('staff may create a %s', async (role) => {
    await expect(create(role, 'STAFF')).resolves.toBeDefined();
  });

  // ...but cannot mint colleagues or bosses.
  it.each(['STAFF', 'GYM_ADMIN', 'SUPER_ADMIN'])('staff may NOT create a %s', async (role) => {
    await expect(create(role, 'STAFF')).rejects.toThrow(ForbiddenException);
  });

  it.each(['MEMBER', 'TRAINER', 'STAFF'])('a gym admin may create a %s', async (role) => {
    await expect(create(role, 'GYM_ADMIN')).resolves.toBeDefined();
  });

  it.each(['GYM_ADMIN', 'SUPER_ADMIN'])('a gym admin may NOT create a %s', async (role) => {
    await expect(create(role, 'GYM_ADMIN')).rejects.toThrow(ForbiddenException);
  });

  it.each(['MEMBER', 'TRAINER', 'STAFF'])('a member/trainer caller may not create a %s at all', async (role) => {
    await expect(create(role, 'MEMBER')).rejects.toThrow(ForbiddenException);
    await expect(create(role, 'TRAINER')).rejects.toThrow(ForbiddenException);
  });

  // A gym-scoped creator must never be able to plant an account in another gym.
  it('ignores a body-supplied gymId for a staff creator', async () => {
    let seenGymId: string | undefined;
    mockPrisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        user: {
          create: jest.fn().mockImplementation(({ data }: any) => {
            seenGymId = data.gymId;
            return Promise.resolve({ id: 'new-user', email: 'a@b.com', role: 'MEMBER' });
          }),
        },
        member: { create: jest.fn().mockResolvedValue({ memberCode: 'M001' }), count: jest.fn().mockResolvedValue(0) },
        trainer: { create: jest.fn() },
        staff: { create: jest.fn() },
        gym: { findUnique: jest.fn().mockResolvedValue({ id: OWN_GYM }) },
      }),
    );

    await service.createUser(
      { firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'Password@123', role: 'MEMBER', gymId: 'someone-elses-gym' },
      'STAFF',
      OWN_GYM,
    );
    expect(seenGymId).toBe(OWN_GYM);
  });
});
