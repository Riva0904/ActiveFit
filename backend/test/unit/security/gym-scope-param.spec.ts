import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { resolveGymScope, resolveGymScopeOptional } from '../../../src/common/utils/gym-scope';
import { PaymentsService } from '../../../src/payments/payments.service';
import { SupplementsService } from '../../../src/supplements/supplements.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const GYM_A = 'gym-A';
const GYM_B = 'gym-B';

describe('resolveGymScope', () => {
  // The whole point of the helper: for a non-super role the requested id is
  // ignored, never validated, so no refactor can turn it into an escalation.
  it.each(['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER'])('ignores a %s-supplied gymId', (role) => {
    expect(resolveGymScope({ role, gymId: GYM_A }, GYM_B)).toBe(GYM_A);
    expect(resolveGymScopeOptional({ role, gymId: GYM_A }, GYM_B)).toBe(GYM_A);
  });

  it('lets a SUPER_ADMIN target a gym explicitly', () => {
    expect(resolveGymScope({ role: 'SUPER_ADMIN', gymId: null }, GYM_B)).toBe(GYM_B);
  });

  // A loud 400 beats silently widening to every tenant, which is exactly the
  // `if (gymId)` bug that leaked payments and trainers.
  it('rejects a SUPER_ADMIN who did not choose a gym', () => {
    expect(() => resolveGymScope({ role: 'SUPER_ADMIN', gymId: null })).toThrow(BadRequestException);
  });

  it('lets the optional variant mean "all gyms" for a SUPER_ADMIN only', () => {
    expect(resolveGymScopeOptional({ role: 'SUPER_ADMIN', gymId: null })).toBeUndefined();
    expect(resolveGymScopeOptional({ role: 'SUPER_ADMIN', gymId: null }, '')).toBeUndefined();
  });

  it('rejects a gym-scoped role with no gym', () => {
    expect(() => resolveGymScope({ role: 'GYM_ADMIN', gymId: null })).toThrow(ForbiddenException);
    expect(() => resolveGymScopeOptional({ role: 'STAFF', gymId: null })).toThrow(ForbiddenException);
  });
});

describe('a caller with no member profile gets nothing, never the gym', () => {
  describe('PaymentsService.findAll', () => {
    const prisma: any = {
      member: { findFirst: jest.fn() },
      payment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    let service: PaymentsService;

    beforeEach(async () => {
      jest.clearAllMocks();
      const mod = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: prisma },
          { provide: 'ConfigService', useValue: { get: jest.fn() } },
        ],
      })
        .overrideProvider(PaymentsService)
        .useValue(new (PaymentsService as any)(prisma, { get: jest.fn() }, { log: jest.fn() }, { emit: jest.fn() }))
        .compile()
        .catch(() => null as any);
      service = mod ? mod.get(PaymentsService) : (new (PaymentsService as any)(prisma));
    });

    it('returns an empty page for a staff caller instead of the gym payment list', async () => {
      prisma.member.findFirst.mockResolvedValue(null);

      const res: any = await service.findAll({ page: 1, limit: 10 }, GYM_A, 'staff-user');

      expect(res).toMatchObject({ data: [], total: 0 });
      // The regression: the old code fell through and queried with `{ gymId }` alone.
      expect(prisma.payment.findMany).not.toHaveBeenCalled();
    });

    it('still scopes a real member to their own payments', async () => {
      prisma.member.findFirst.mockResolvedValue({ id: 'member-1' });

      await service.findAll({ page: 1, limit: 10 }, GYM_A, 'member-user');

      expect(prisma.payment.findMany.mock.calls[0][0].where).toMatchObject({ gymId: GYM_A, memberId: 'member-1' });
    });
  });

  describe('SupplementsService.getOrders', () => {
    const prisma: any = {
      supplementOrder: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    let service: SupplementsService;

    beforeEach(() => {
      jest.clearAllMocks();
      service = new (SupplementsService as any)(prisma, { createRazorpayOrder: jest.fn() });
    });

    it('returns an empty page when "mine" is asked for but no user resolves', async () => {
      const res: any = await service.getOrders({ page: 1, limit: 10 }, GYM_A, undefined, true);

      expect(res).toMatchObject({ data: [], total: 0 });
      expect(prisma.supplementOrder.findMany).not.toHaveBeenCalled();
    });

    it('scopes to the caller when "mine" is asked for with a user', async () => {
      await service.getOrders({ page: 1, limit: 10 }, GYM_A, 'user-1', true);
      expect(prisma.supplementOrder.findMany.mock.calls[0][0].where).toMatchObject({ gymId: GYM_A, userId: 'user-1' });
    });

    it('lets an admin read the gym order book', async () => {
      await service.getOrders({ page: 1, limit: 10 }, GYM_A);
      expect(prisma.supplementOrder.findMany.mock.calls[0][0].where).toEqual({ gymId: GYM_A });
    });
  });
});
