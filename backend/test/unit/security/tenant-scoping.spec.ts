import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../../../src/users/users.service';
import { UsersController } from '../../../src/users/users.controller';
import { TrainersService } from '../../../src/trainers/trainers.service';
import { TrainersController } from '../../../src/trainers/trainers.controller';
import { StaffsService } from '../../../src/staffs/staffs.service';
import { StaffsController } from '../../../src/staffs/staffs.controller';
import { SupplementsService } from '../../../src/supplements/supplements.service';
import { SupplementsController } from '../../../src/supplements/supplements.controller';
import { MembershipsService } from '../../../src/memberships/memberships.service';
import { MembershipsController } from '../../../src/memberships/memberships.controller';
import { PaymentsService } from '../../../src/payments/payments.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EmailService } from '../../../src/email/email.service';
import { AuditService } from '../../../src/common/services/audit.service';
import { EntitlementsService } from '../../../src/entitlements/entitlements.service';

// Plan limits and feature gates live in EntitlementsService now; these suites
// exercise the surrounding logic, so it is stubbed permissive.
const mockEntitlements = {
  assertWithinLimit: jest.fn().mockResolvedValue(undefined),
  assertFeature: jest.fn().mockResolvedValue(undefined),
  hasFeature: jest.fn().mockResolvedValue(true),
  assertActive: jest.fn().mockResolvedValue(undefined),
  getEntitlement: jest.fn().mockResolvedValue({ plan: 'PROFESSIONAL', isActive: true, features: new Set(), limits: {} }),
  getUsage: jest.fn().mockResolvedValue({ members: 0, trainers: 0, staff: 0, branches: 0 }),
  invalidate: jest.fn(),
};


/**
 * Cross-tenant IDOR regression cover. Every /:id mutation in these five modules
 * used to look the row up by id alone, so a GYM_ADMIN of gym A could read, edit,
 * renew, deactivate or hard-delete rows belonging to gym B (and SUPER_ADMIN users,
 * which have no gymId at all).
 *
 * Contract under test, at both layers:
 *   controller: GYM_ADMIN  → service receives caller.gymId
 *               SUPER_ADMIN → service receives undefined (unscoped)
 *               gym-less non-super → 403 before the service is touched
 *   service:    lookup is `findFirst({ id, gymId })` when scoped, `findFirst({ id })` when not;
 *               a miss (other tenant's id) is a 404 and NO write happens.
 */

const GYM_ADMIN_A = { id: 'admin-A', role: 'GYM_ADMIN', gymId: 'gym-A' };
const SUPER = { id: 'sa', role: 'SUPER_ADMIN', gymId: null };
const GYMLESS_ADMIN = { id: 'orphan', role: 'GYM_ADMIN', gymId: null };

const rowInGymB = { id: 'row-1', gymId: 'gym-B', userId: 'victim-user' };

function prismaStub() {
  const model = () => ({
    findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(),
    updateMany: jest.fn(), delete: jest.fn(), deleteMany: jest.fn(), count: jest.fn(),
  });
  return {
    user: model(), member: model(), trainer: model(), staff: model(), supplement: model(),
    supplementOrder: model(), memberSubscription: model(), membershipPlan: model(),
    trainerAssignment: model(), workoutPlan: model(), dietPlan: model(), workoutAssignment: model(),
    dietAssignment: model(), attendance: model(), progressLog: model(), payment: model(),
    notification: model(), otpCode: model(), auditLog: model(),
    $transaction: jest.fn(async (fn: any) => fn(this)),
  } as any;
}

// ─── Users ─────────────────────────────────────────────────────────────────

describe('Users — tenant scoping', () => {
  let service: UsersService;
  let controller: UsersController;
  let prisma: any;
  const svcMock = { findOne: jest.fn(), update: jest.fn(), deactivate: jest.fn(), activate: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    prisma = prismaStub();
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma }, { provide: EntitlementsService, useValue: mockEntitlements },
        { provide: EmailService, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = mod.get(UsersService);

    const cmod = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: svcMock }],
    }).compile();
    controller = cmod.get(UsersController);
    jest.clearAllMocks();
  });

  describe('controller passes the caller scope', () => {
    it.each([
      ['findOne', (c: UsersController, u: any) => c.findOne('x', u)],
      ['update', (c: UsersController, u: any) => c.update('x', { firstName: 'A' } as any, u)],
      ['deactivate', (c: UsersController, u: any) => c.deactivate('x', u)],
      ['activate', (c: UsersController, u: any) => c.activate('x', u)],
      ['remove', (c: UsersController, u: any) => c.remove('x', u)],
    ])('%s: GYM_ADMIN → own gymId, SUPER_ADMIN → undefined, gym-less → 403', (name, call) => {
      call(controller, GYM_ADMIN_A);
      expect((svcMock as any)[name].mock.calls[0].at(-1)).toBe('gym-A');

      call(controller, SUPER);
      expect((svcMock as any)[name].mock.calls[1].at(-1)).toBeUndefined();

      expect(() => call(controller, GYMLESS_ADMIN)).toThrow(ForbiddenException);
      expect((svcMock as any)[name]).toHaveBeenCalledTimes(2);
    });

    it('getMe is unscoped (own id) so a gym-less user can still load their profile', () => {
      controller.getMe('me-id');
      expect(svcMock.findOne).toHaveBeenCalledWith('me-id');
    });
  });

  describe('service lookups', () => {
    it('findOne adds gymId to the where clause when scoped', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'row-1', gymId: 'gym-A' });
      await service.findOne('row-1', 'gym-A');
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'row-1', gymId: 'gym-A' });
    });

    it('findOne omits gymId for SUPER_ADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'row-1' });
      await service.findOne('row-1', undefined);
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'row-1' });
    });

    it.each([
      ['update', (s: UsersService) => s.update('row-1', { firstName: 'X' }, 'gym-A')],
      ['deactivate', (s: UsersService) => s.deactivate('row-1', 'gym-A')],
      ['activate', (s: UsersService) => s.activate('row-1', 'gym-A')],
      ['remove', (s: UsersService) => s.remove('row-1', 'gym-A')],
    ])('%s on another tenant\'s user → 404 and no write', async (_name, call) => {
      prisma.user.findFirst.mockResolvedValue(null); // gym-A scope cannot see a gym-B row
      await expect(call(service)).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('a SUPER_ADMIN account (gymId null) is invisible to a GYM_ADMIN scope', async () => {
      // Prisma would never match { id, gymId: 'gym-A' } against a null-gym row; model that.
      prisma.user.findFirst.mockImplementation(async ({ where }: any) =>
        where.gymId === undefined ? { id: 'sa', gymId: null, role: 'SUPER_ADMIN' } : null,
      );
      await expect(service.deactivate('sa', 'gym-A')).rejects.toThrow(NotFoundException);
      await expect(service.deactivate('sa', undefined)).resolves.toBeUndefined(); // super admin can
    });

    it('remove within own tenant still runs the cascade', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'row-1', gymId: 'gym-A' });
      prisma.trainer.findUnique.mockResolvedValue(null);
      prisma.staff.findUnique.mockResolvedValue(null);
      prisma.member.findFirst.mockResolvedValue(null);
      await service.remove('row-1', 'gym-A');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'row-1' } });
    });
  });
});

// ─── Trainers ──────────────────────────────────────────────────────────────

describe('Trainers — tenant scoping', () => {
  let service: TrainersService;
  let controller: TrainersController;
  let prisma: any;
  const svcMock = { findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    prisma = prismaStub();
    service = (await Test.createTestingModule({
      providers: [TrainersService, { provide: PrismaService, useValue: prisma }, { provide: EntitlementsService, useValue: mockEntitlements }],
    }).compile()).get(TrainersService);
    controller = (await Test.createTestingModule({
      controllers: [TrainersController],
      providers: [
        { provide: TrainersService, useValue: svcMock },
        { provide: UsersService, useValue: {} },
      ],
    }).compile()).get(TrainersController);
    jest.clearAllMocks();
  });

  // update(id, dto, gymId, selfUserId) carries an extra trailing arg — read the scope by index.
  it.each([
    ['findOne', 1, (c: TrainersController, u: any) => c.findOne('x', u)],
    ['update', 2, (c: TrainersController, u: any) => c.update('x', { bio: 'b' }, u)],
    ['remove', 1, (c: TrainersController, u: any) => c.remove('x', u)],
  ])('controller %s: scope resolution', (name, scopeIdx, call) => {
    call(controller, GYM_ADMIN_A);
    expect((svcMock as any)[name].mock.calls[0][scopeIdx]).toBe('gym-A');
    call(controller, SUPER);
    expect((svcMock as any)[name].mock.calls[1][scopeIdx]).toBeUndefined();
    expect(() => call(controller, GYMLESS_ADMIN)).toThrow(ForbiddenException);
  });

  it('a TRAINER updating is pinned to their own user id; admins are not', () => {
    controller.update('t1', { bio: 'b' }, { id: 'me', role: 'TRAINER', gymId: 'gym-A' });
    expect(svcMock.update).toHaveBeenLastCalledWith('t1', { bio: 'b' }, 'gym-A', 'me');
    controller.update('t1', { bio: 'b' }, GYM_ADMIN_A);
    expect(svcMock.update).toHaveBeenLastCalledWith('t1', { bio: 'b' }, 'gym-A', undefined);
  });

  it('a MEMBER viewing a trainer is scoped to their own gym', () => {
    controller.findOne('t', { id: 'm', role: 'MEMBER', gymId: 'gym-A' });
    expect(svcMock.findOne).toHaveBeenCalledWith('t', 'gym-A');
  });

  it('service: scoped findFirst, 404 on miss, no write', async () => {
    prisma.trainer.findFirst.mockResolvedValue(null);
    await expect(service.update('row-1', { bio: 'x' }, 'gym-A')).rejects.toThrow(NotFoundException);
    await expect(service.remove('row-1', 'gym-A')).rejects.toThrow(NotFoundException);
    for (const call of prisma.trainer.findFirst.mock.calls) expect(call[0].where).toMatchObject({ id: 'row-1', gymId: 'gym-A' });
    expect(prisma.trainer.update).not.toHaveBeenCalled();
    expect(prisma.trainer.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('service: remove in own tenant deletes trainer + user', async () => {
    prisma.trainer.findFirst.mockResolvedValue(rowInGymB);
    prisma.user.delete.mockResolvedValue({});
    await service.remove('row-1', 'gym-B');
    expect(prisma.trainer.delete).toHaveBeenCalledWith({ where: { id: 'row-1' } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'victim-user' } });
  });
});

// ─── Staffs ────────────────────────────────────────────────────────────────

describe('Staffs — tenant scoping', () => {
  let service: StaffsService;
  let controller: StaffsController;
  let prisma: any;
  const svcMock = { findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    prisma = prismaStub();
    service = (await Test.createTestingModule({
      providers: [StaffsService, { provide: PrismaService, useValue: prisma }, { provide: EntitlementsService, useValue: mockEntitlements }],
    }).compile()).get(StaffsService);
    controller = (await Test.createTestingModule({
      controllers: [StaffsController],
      providers: [
        { provide: StaffsService, useValue: svcMock },
        { provide: UsersService, useValue: {} },
      ],
    }).compile()).get(StaffsController);
    jest.clearAllMocks();
  });

  it.each([
    ['findOne', (c: StaffsController, u: any) => c.findOne('x', u)],
    ['update', (c: StaffsController, u: any) => c.update('x', { designation: 'd' }, u)],
    ['remove', (c: StaffsController, u: any) => c.remove('x', u)],
  ])('controller %s: scope resolution', (name, call) => {
    call(controller, GYM_ADMIN_A);
    expect((svcMock as any)[name].mock.calls[0].at(-1)).toBe('gym-A');
    call(controller, SUPER);
    expect((svcMock as any)[name].mock.calls[1].at(-1)).toBeUndefined();
    expect(() => call(controller, GYMLESS_ADMIN)).toThrow(ForbiddenException);
  });

  it('service: scoped findFirst, 404 on miss, no write', async () => {
    prisma.staff.findFirst.mockResolvedValue(null);
    await expect(service.findOne('row-1', 'gym-A')).rejects.toThrow(NotFoundException);
    await expect(service.update('row-1', { salary: 1 }, 'gym-A')).rejects.toThrow(NotFoundException);
    await expect(service.remove('row-1', 'gym-A')).rejects.toThrow(NotFoundException);
    for (const call of prisma.staff.findFirst.mock.calls) expect(call[0].where).toMatchObject({ id: 'row-1', gymId: 'gym-A' });
    expect(prisma.staff.update).not.toHaveBeenCalled();
    expect(prisma.staff.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});

// ─── Supplements ───────────────────────────────────────────────────────────

describe('Supplements — tenant scoping', () => {
  let service: SupplementsService;
  let controller: SupplementsController;
  let prisma: any;
  const svcMock = { findOne: jest.fn(), update: jest.fn(), updateStock: jest.fn(), updateOrderStatus: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    prisma = prismaStub();
    service = (await Test.createTestingModule({
      providers: [
        SupplementsService,
        { provide: PrismaService, useValue: prisma }, { provide: EntitlementsService, useValue: mockEntitlements },
        { provide: PaymentsService, useValue: {} },
      ],
    }).compile()).get(SupplementsService);
    controller = (await Test.createTestingModule({
      controllers: [SupplementsController],
      providers: [{ provide: SupplementsService, useValue: svcMock }],
    }).compile()).get(SupplementsController);
    jest.clearAllMocks();
  });

  // `scopeAt` is the argument index carrying the tenant scope. It is the last
  // one everywhere except `findOne`, which now also receives the caller so a
  // member cannot fetch a supplement that was made private to someone else.
  it.each([
    ['findOne', (c: SupplementsController, u: any) => c.findOne('x', u), 1],
    ['update', (c: SupplementsController, u: any) => c.update('x', { name: 'n' }, u), -1],
    ['updateStock', (c: SupplementsController, u: any) => c.updateStock('x', 5, u), -1],
    ['updateOrderStatus', (c: SupplementsController, u: any) => c.updateOrderStatus('x', 'CONFIRMED', u), -1],
    ['remove', (c: SupplementsController, u: any) => c.remove('x', u), -1],
  ])('controller %s: scope resolution', (name, call, scopeAt) => {
    const scopeOf = (args: any[]) => (scopeAt === -1 ? args.at(-1) : args[scopeAt as number]);

    call(controller, GYM_ADMIN_A);
    expect(scopeOf((svcMock as any)[name].mock.calls[0])).toBe('gym-A');
    call(controller, SUPER);
    expect(scopeOf((svcMock as any)[name].mock.calls[1])).toBeUndefined();
    expect(() => call(controller, GYMLESS_ADMIN)).toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN remove is no longer broken by a null gymId filter', () => {
    controller.remove('x', SUPER);
    expect(svcMock.remove).toHaveBeenCalledWith('x', undefined);
  });

  it('service: product lookups scoped; miss → 404, no write', async () => {
    prisma.supplement.findFirst.mockResolvedValue(null);
    await expect(service.update('row-1', { price: 1 }, 'gym-A')).rejects.toThrow(NotFoundException);
    await expect(service.updateStock('row-1', 5, 'gym-A')).rejects.toThrow(NotFoundException);
    await expect(service.remove('row-1', 'gym-A')).rejects.toThrow(NotFoundException);
    for (const call of prisma.supplement.findFirst.mock.calls) expect(call[0].where).toEqual({ id: 'row-1', gymId: 'gym-A' });
    expect(prisma.supplement.update).not.toHaveBeenCalled();
  });

  it('service: order status transition scoped; another gym\'s order → 404', async () => {
    prisma.supplementOrder.findFirst.mockResolvedValue(null);
    await expect(service.updateOrderStatus('ord-1', 'CONFIRMED', 'gym-A')).rejects.toThrow(NotFoundException);
    expect(prisma.supplementOrder.findFirst.mock.calls[0][0].where).toEqual({ id: 'ord-1', gymId: 'gym-A' });
    expect(prisma.supplementOrder.update).not.toHaveBeenCalled();
  });

  it('service: own-gym order transition still works', async () => {
    prisma.supplementOrder.findFirst.mockResolvedValue({ id: 'ord-1', gymId: 'gym-A', status: 'PENDING' });
    prisma.supplementOrder.update.mockResolvedValue({ status: 'CONFIRMED' });
    await expect(service.updateOrderStatus('ord-1', 'CONFIRMED', 'gym-A')).resolves.toEqual({ status: 'CONFIRMED' });
  });
});

// ─── Memberships ───────────────────────────────────────────────────────────

describe('Memberships — tenant scoping', () => {
  let service: MembershipsService;
  let controller: MembershipsController;
  let prisma: any;
  const svcMock = { update: jest.fn(), renew: jest.fn() };

  beforeEach(async () => {
    prisma = prismaStub();
    service = (await Test.createTestingModule({
      providers: [MembershipsService, { provide: PrismaService, useValue: prisma }, { provide: EntitlementsService, useValue: mockEntitlements }],
    }).compile()).get(MembershipsService);
    controller = (await Test.createTestingModule({
      controllers: [MembershipsController],
      providers: [{ provide: MembershipsService, useValue: svcMock }],
    }).compile()).get(MembershipsController);
    jest.clearAllMocks();
  });

  it.each([
    ['update', (c: MembershipsController, u: any) => c.update('x', { status: 'ACTIVE' } as any, u)],
    ['renew', (c: MembershipsController, u: any) => c.renew('x', u)],
  ])('controller %s: scope resolution', (name, call) => {
    call(controller, GYM_ADMIN_A);
    expect((svcMock as any)[name].mock.calls[0].at(-1)).toBe('gym-A');
    call(controller, SUPER);
    expect((svcMock as any)[name].mock.calls[1].at(-1)).toBeUndefined();
    expect(() => call(controller, GYMLESS_ADMIN)).toThrow(ForbiddenException);
  });

  it('service: renew of another gym\'s subscription → 404, no free extension granted', async () => {
    prisma.memberSubscription.findFirst.mockResolvedValue(null);
    await expect(service.renew('sub-1', 'gym-A')).rejects.toThrow(NotFoundException);
    expect(prisma.memberSubscription.findFirst.mock.calls[0][0].where).toEqual({ id: 'sub-1', gymId: 'gym-A' });
    expect(prisma.memberSubscription.update).not.toHaveBeenCalled();
  });

  it('service: update of another gym\'s subscription → 404', async () => {
    prisma.memberSubscription.findFirst.mockResolvedValue(null);
    await expect(service.update('sub-1', { status: 'ACTIVE' as any }, 'gym-A')).rejects.toThrow(NotFoundException);
    expect(prisma.memberSubscription.update).not.toHaveBeenCalled();
  });

  it('service: renew in own gym extends from endDate when still active', async () => {
    const future = new Date(Date.now() + 10 * 86400000);
    prisma.memberSubscription.findFirst.mockResolvedValue({ id: 'sub-1', gymId: 'gym-A', endDate: future, plan: { type: 'MONTHLY' } });
    prisma.memberSubscription.update.mockImplementation(async (a: any) => a.data);
    const res: any = await service.renew('sub-1', 'gym-A');
    expect(res.startDate).toEqual(future);
    expect(res.status).toBe('ACTIVE');
  });

  it('service: SUPER_ADMIN renew is unscoped', async () => {
    prisma.memberSubscription.findFirst.mockResolvedValue({ id: 'sub-1', endDate: new Date(0), plan: { type: 'MONTHLY' } });
    prisma.memberSubscription.update.mockResolvedValue({});
    await service.renew('sub-1', undefined);
    expect(prisma.memberSubscription.findFirst.mock.calls[0][0].where).toEqual({ id: 'sub-1' });
  });
});
