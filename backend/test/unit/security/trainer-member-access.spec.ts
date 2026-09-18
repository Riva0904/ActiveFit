import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { resolveReadableMember } from '../../../src/common/utils/trainer-access';

/**
 * Trainers can now read a member's attendance and body measurements. That is a
 * genuine widening of access, so the gate is tested directly: a trainer must get
 * through for their own assignees and for nobody else.
 *
 * Without this, handing trainers `GET /progress-logs/member/:id` would expose
 * every member's weight, body fat and photos to every trainer in the gym.
 */
const GYM = 'gym-A';
const TRAINER = { id: 'trainer-user-1', role: 'TRAINER' };
const ADMIN = { id: 'admin-1', role: 'GYM_ADMIN' };
const SUPER = { id: 'sa-1', role: 'SUPER_ADMIN' };

function prismaStub(overrides: any = {}) {
  return {
    member: { findFirst: jest.fn().mockResolvedValue({ id: 'mem-1' }) },
    trainer: { findFirst: jest.fn().mockResolvedValue({ id: 'tr-1' }) },
    trainerAssignment: { findFirst: jest.fn().mockResolvedValue({ id: 'ta-1' }) },
    ...overrides,
  } as any;
}

describe('resolveReadableMember', () => {
  it('lets a trainer read a member assigned to them', async () => {
    const prisma = prismaStub();
    await expect(resolveReadableMember(prisma, TRAINER, 'mem-1', GYM)).resolves.toBe('mem-1');

    // The assignment must be the *active* one, in this gym, for this trainer.
    expect(prisma.trainerAssignment.findFirst.mock.calls[0][0].where).toEqual({
      trainerId: 'tr-1', memberId: 'mem-1', gymId: GYM, isActive: true,
    });
  });

  it('refuses a trainer for a member who is not theirs', async () => {
    const prisma = prismaStub({ trainerAssignment: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(resolveReadableMember(prisma, TRAINER, 'mem-1', GYM)).rejects.toThrow(ForbiddenException);
  });

  it('refuses a trainer whose assignment was ended', async () => {
    // `unassignMember` flips isActive to false rather than deleting the row, so
    // a stale row must not still grant access.
    const prisma = prismaStub({
      trainerAssignment: {
        findFirst: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.isActive === true ? null : { id: 'ta-old' }),
        ),
      },
    });
    await expect(resolveReadableMember(prisma, TRAINER, 'mem-1', GYM)).rejects.toThrow(ForbiddenException);
  });

  it('refuses someone with the TRAINER role but no trainer record in this gym', async () => {
    const prisma = prismaStub({ trainer: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(resolveReadableMember(prisma, TRAINER, 'mem-1', GYM)).rejects.toThrow(ForbiddenException);
    expect(prisma.trainerAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('404s a member from another gym before any assignment check runs', async () => {
    const prisma = prismaStub({ member: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(resolveReadableMember(prisma, TRAINER, 'mem-other-gym', GYM)).rejects.toThrow(NotFoundException);
    expect(prisma.trainer.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['gym admin', ADMIN],
    ['super admin', SUPER],
  ])('lets a %s read any member in scope without an assignment', async (_label, caller) => {
    const prisma = prismaStub({ trainerAssignment: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(resolveReadableMember(prisma, caller, 'mem-1', GYM)).resolves.toBe('mem-1');
    expect(prisma.trainerAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('accepts either a member id or the underlying user id', async () => {
    const prisma = prismaStub({
      member: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)              // not a member-table id
          .mockResolvedValueOnce({ id: 'mem-9' }),  // resolved via userId
      },
    });
    await expect(resolveReadableMember(prisma, ADMIN, 'user-9', GYM)).resolves.toBe('mem-9');
    expect(prisma.member.findFirst.mock.calls[0][0].where).toEqual({ id: 'user-9', gymId: GYM });
    expect(prisma.member.findFirst.mock.calls[1][0].where).toEqual({ userId: 'user-9', gymId: GYM });
  });

  it('always scopes the member lookup to the caller’s gym', async () => {
    const prisma = prismaStub();
    await resolveReadableMember(prisma, ADMIN, 'mem-1', GYM);
    expect(prisma.member.findFirst.mock.calls[0][0].where.gymId).toBe(GYM);
  });
});
