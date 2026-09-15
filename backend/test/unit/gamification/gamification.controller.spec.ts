import { Test } from '@nestjs/testing';
import { GamificationController } from '../../../src/gamification/gamification.controller';
import { PointsService } from '../../../src/gamification/points.service';
import { BadgeService } from '../../../src/gamification/badge.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const USER_ID = 'user-001';
const MEMBER_ID = 'member-001';
const GYM_ID = 'gym-001';

describe('GamificationController — reads must use Member.id, not the JWT user id', () => {
  const prisma = { member: { findFirst: jest.fn() } };
  const badges = { getMemberBadges: jest.fn().mockResolvedValue([{ id: 'first_checkin', earned: true }]) };
  let controller: GamificationController;
  let points: PointsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [
        PointsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BadgeService, useValue: badges },
      ],
    }).compile();
    controller = mod.get(GamificationController);
    points = mod.get(PointsService);
    jest.spyOn(points, 'getMemberPoints').mockResolvedValue(45);
  });

  it('resolves the member row and reads points with Member.id', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });

    const res = await controller.getMyPoints({ id: USER_ID, gymId: GYM_ID });

    expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { userId: USER_ID, gymId: GYM_ID }, select: { id: true } });
    expect(points.getMemberPoints).toHaveBeenCalledWith(MEMBER_ID, GYM_ID);
    expect(points.getMemberPoints).not.toHaveBeenCalledWith(USER_ID, GYM_ID);
    expect(res).toEqual({ points: 45 });
  });

  it('resolves the member row for badges too', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });

    await controller.getMyBadges({ id: USER_ID, gymId: GYM_ID });

    expect(badges.getMemberBadges).toHaveBeenCalledWith(MEMBER_ID, GYM_ID);
    expect(badges.getMemberBadges).not.toHaveBeenCalledWith(USER_ID, GYM_ID);
  });

  it('returns empty results for roles without a member profile (trainer/staff/admin)', async () => {
    prisma.member.findFirst.mockResolvedValue(null);

    await expect(controller.getMyPoints({ id: 'trainer-1', gymId: GYM_ID })).resolves.toEqual({ points: 0 });
    await expect(controller.getMyBadges({ id: 'trainer-1', gymId: GYM_ID })).resolves.toEqual([]);
    expect(points.getMemberPoints).not.toHaveBeenCalled();
    expect(badges.getMemberBadges).not.toHaveBeenCalled();
  });

  it('never queries with a missing gymId (SUPER_ADMIN)', async () => {
    await expect(controller.getMyPoints({ id: USER_ID, gymId: null })).resolves.toEqual({ points: 0 });
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });

  it('points awarded by a run are visible through the same id the award used', async () => {
    // award() writes with Member.id; the read path must translate to that same id.
    prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
    (points.getMemberPoints as jest.Mock).mockImplementation(async (id: string) => (id === MEMBER_ID ? 15 : 0));

    await expect(controller.getMyPoints({ id: USER_ID, gymId: GYM_ID })).resolves.toEqual({ points: 15 });
  });
});

describe('PointsService.resolveMemberId', () => {
  const prisma = { member: { findFirst: jest.fn() } };
  let points: PointsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [PointsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    points = mod.get(PointsService);
  });

  it('returns the member id when one exists', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
    await expect(points.resolveMemberId(USER_ID, GYM_ID)).resolves.toBe(MEMBER_ID);
  });

  it('returns null when the user has no member row in that gym', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(points.resolveMemberId(USER_ID, GYM_ID)).resolves.toBeNull();
  });

  it('short-circuits on a missing user or gym', async () => {
    await expect(points.resolveMemberId('', GYM_ID)).resolves.toBeNull();
    await expect(points.resolveMemberId(USER_ID, '')).resolves.toBeNull();
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the caller gym (no cross-tenant read)', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: MEMBER_ID });
    await points.resolveMemberId(USER_ID, GYM_ID);
    expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { userId: USER_ID, gymId: GYM_ID }, select: { id: true } });
  });
});
