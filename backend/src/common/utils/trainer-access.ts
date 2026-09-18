import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves a member for a caller who wants to read that member's private data
 * (attendance, progress logs, photos).
 *
 * A gym admin or super admin may read anyone in scope. A **trainer may read only
 * their own assignees** — without that check, giving trainers these endpoints
 * would hand every trainer the whole gym's body measurements.
 *
 * `memberIdOrUserId` accepts either key because the app holds a user id on the
 * people list and a member id on the trainer's roster.
 *
 * Returns the resolved Member id.
 */
export async function resolveReadableMember(
  prisma: PrismaService,
  caller: { id: string; role: string },
  memberIdOrUserId: string,
  gymId: string,
): Promise<string> {
  const member =
    (await prisma.member.findFirst({ where: { id: memberIdOrUserId, gymId }, select: { id: true } })) ??
    (await prisma.member.findFirst({ where: { userId: memberIdOrUserId, gymId }, select: { id: true } }));
  if (!member) throw new NotFoundException('Member not found in this gym');

  if (caller.role !== 'TRAINER') return member.id;

  const trainer = await prisma.trainer.findFirst({
    where: { userId: caller.id, gymId },
    select: { id: true },
  });
  if (!trainer) throw new ForbiddenException('You are not a trainer at this gym');

  const assignment = await prisma.trainerAssignment.findFirst({
    where: { trainerId: trainer.id, memberId: member.id, gymId, isActive: true },
    select: { id: true },
  });
  if (!assignment) throw new ForbiddenException('That member is not assigned to you');

  return member.id;
}
