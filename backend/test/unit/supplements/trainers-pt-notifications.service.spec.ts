/**
 * Combined spec covering trainers, pt-sessions, notifications, and workout plans.
 * One file to avoid duplicating the shared prisma stub for these lighter services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TrainersService } from '../../../src/trainers/trainers.service';
import { PtSessionsService } from '../../../src/pt-sessions/pt-sessions.service';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { WorkoutPlansService } from '../../../src/workout-plans/workout-plans.service';
import { PaymentsService } from '../../../src/payments/payments.service';
import { PushService } from '../../../src/common/services/push.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const model = () => ({
  findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
  createMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(), upsert: jest.fn(),
  delete: jest.fn(), deleteMany: jest.fn(), count: jest.fn(),
});
const makePrisma = () => ({
  trainer: model(), member: model(), trainerAssignment: model(), ptSession: model(),
  notification: model(), user: model(), workoutPlan: model(), workoutAssignment: model(),
});

const userSel = { id: 'u1', firstName: 'Alex', lastName: 'Doe', email: 'a@x.com', phone: null, avatar: null };

// ─── TrainersService ─────────────────────────────────────────────────────────

describe('TrainersService', () => {
  let service: TrainersService;
  let prisma: ReturnType<typeof makePrisma>;
  const mockTrainer = { id: 'trainer-001', userId: 'u1', gymId: 'gym-001', rating: 4.5, experience: 5, hourlyRate: 500, user: userSel, _count: { memberAssignments: 3 } };

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrainersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TrainersService);
  });

  it('findAll paginates and scopes by gym', async () => {
    prisma.trainer.findMany.mockResolvedValue([mockTrainer]);
    prisma.trainer.count.mockResolvedValue(1);
    const res: any = await service.findAll({ page: 1, limit: 10 }, 'gym-001');
    expect(res.total).toBe(1);
    expect(prisma.trainer.findMany.mock.calls[0][0].where.gymId).toBe('gym-001');
  });

  it('findAll searches on the linked user', async () => {
    prisma.trainer.findMany.mockResolvedValue([]);
    prisma.trainer.count.mockResolvedValue(0);
    await service.findAll({ search: 'alex' }, 'gym-001');
    expect(prisma.trainer.findMany.mock.calls[0][0].where.user.OR).toHaveLength(3);
  });

  it('findOne throws NotFoundException when missing', async () => {
    prisma.trainer.findFirst.mockResolvedValue(null);
    await expect(service.findOne('nope', 'gym-001')).rejects.toThrow(NotFoundException);
  });

  it('update as a TRAINER is limited to their own record', async () => {
    prisma.trainer.findFirst.mockResolvedValue(mockTrainer);
    prisma.trainer.update.mockResolvedValue(mockTrainer);
    await expect(service.update('trainer-001', { bio: 'x' }, 'gym-001', 'someone-else')).rejects.toThrow(NotFoundException);
    expect(prisma.trainer.update).not.toHaveBeenCalled();
    await service.update('trainer-001', { bio: 'x' }, 'gym-001', 'u1');
    expect(prisma.trainer.update).toHaveBeenCalledWith({ where: { id: 'trainer-001' }, data: { bio: 'x' } });
  });

  describe('assignMember', () => {
    it('throws NotFoundException when the trainer is not in the gym', async () => {
      prisma.trainer.findFirst.mockResolvedValue(null);
      await expect(service.assignMember('t', 'm', 'gym-001')).rejects.toThrow(NotFoundException);
    });

    it('accepts a Member id and upserts an active assignment', async () => {
      prisma.trainer.findFirst.mockResolvedValue(mockTrainer);
      prisma.member.findFirst.mockResolvedValueOnce({ id: 'member-001', gymId: 'gym-001' });
      prisma.trainerAssignment.upsert.mockResolvedValue({});
      await service.assignMember('trainer-001', 'member-001', 'gym-001');
      expect(prisma.trainerAssignment.upsert).toHaveBeenCalledWith({
        where: { trainerId_memberId: { trainerId: 'trainer-001', memberId: 'member-001' } },
        create: { trainerId: 'trainer-001', memberId: 'member-001', gymId: 'gym-001', isActive: true },
        update: { isActive: true },
      });
    });

    it('falls back to resolving a User id to its Member row', async () => {
      prisma.trainer.findFirst.mockResolvedValue(mockTrainer);
      prisma.member.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'member-002' });
      prisma.trainerAssignment.upsert.mockResolvedValue({});
      await service.assignMember('trainer-001', 'user-002', 'gym-001');
      expect(prisma.member.findFirst.mock.calls[1][0].where).toEqual({ userId: 'user-002', gymId: 'gym-001' });
      expect(prisma.trainerAssignment.upsert.mock.calls[0][0].create.memberId).toBe('member-002');
    });

    it('throws NotFoundException when neither id resolves', async () => {
      prisma.trainer.findFirst.mockResolvedValue(mockTrainer);
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.assignMember('trainer-001', 'ghost', 'gym-001')).rejects.toThrow(NotFoundException);
    });
  });

  it('getPerformance flattens trainer + assignment counts', async () => {
    prisma.trainer.findMany.mockResolvedValue([mockTrainer]);
    const res = await service.getPerformance('gym-001');
    expect(res[0]).toEqual({ id: 'trainer-001', name: 'Alex Doe', assignedMembers: 3, rating: 4.5, experience: 5, hourlyRate: 500 });
  });
});

// ─── PtSessionsService ───────────────────────────────────────────────────────

describe('PtSessionsService', () => {
  let service: PtSessionsService;
  let prisma: ReturnType<typeof makePrisma>;
  const mockSession = { id: 'sess-001', gymId: 'gym-001', trainerId: 'trainer-001', memberId: 'member-001', status: 'SCHEDULED', scheduledAt: new Date() };

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PtSessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: { createRazorpayOrder: jest.fn() } },
      ],
    }).compile();
    service = module.get(PtSessionsService);
  });

  it('findAll filters by gym, trainer and status (ALL = no status filter)', async () => {
    prisma.ptSession.findMany.mockResolvedValue([]);
    prisma.ptSession.count.mockResolvedValue(0);
    await service.findAll({ status: 'ALL' }, 'gym-001', 'trainer-001');
    expect(prisma.ptSession.findMany.mock.calls[0][0].where).toEqual({ gymId: 'gym-001', trainerId: 'trainer-001' });
    await service.findAll({ status: 'COMPLETED' }, 'gym-001');
    expect(prisma.ptSession.findMany.mock.calls[1][0].where).toEqual({ gymId: 'gym-001', status: 'COMPLETED' });
  });

  describe('create', () => {
    const body = { trainerId: 'trainer-001', memberId: 'member-001', scheduledAt: '2026-10-01T10:00:00.000Z', duration: '45' };

    it('rejects missing required fields', async () => {
      await expect(service.create({}, 'gym-001')).rejects.toThrow(BadRequestException);
      await expect(service.create({ trainerId: 't' }, 'gym-001')).rejects.toThrow(BadRequestException);
      await expect(service.create({ trainerId: 't', memberId: 'm' }, 'gym-001')).rejects.toThrow(BadRequestException);
    });

    it('validates trainer and member belong to the gym', async () => {
      prisma.trainer.findFirst.mockResolvedValue(null);
      await expect(service.create(body, 'gym-001')).rejects.toThrow(NotFoundException);
      prisma.trainer.findFirst.mockResolvedValue({ id: 'trainer-001' });
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.create(body, 'gym-001')).rejects.toThrow(NotFoundException);
    });

    it('creates the session with coerced duration/date', async () => {
      prisma.trainer.findFirst.mockResolvedValue({ id: 'trainer-001' });
      prisma.member.findFirst.mockResolvedValue({ id: 'member-001' });
      prisma.ptSession.create.mockResolvedValue(mockSession);
      await service.create(body, 'gym-001');
      const { data } = prisma.ptSession.create.mock.calls[0][0];
      expect(data).toMatchObject({ gymId: 'gym-001', trainerId: 'trainer-001', memberId: 'member-001', duration: 45, title: null });
      expect(data.scheduledAt).toBeInstanceOf(Date);
    });

    it('a trainer creating a session is pinned to their own trainerId', async () => {
      prisma.trainer.findFirst.mockResolvedValue({ id: 'me' });
      prisma.member.findFirst.mockResolvedValue({ id: 'member-001' });
      prisma.ptSession.create.mockResolvedValue(mockSession);
      await service.create({ ...body, trainerId: 'someone-else' }, 'gym-001', 'me');
      expect(prisma.trainer.findFirst.mock.calls[0][0].where.id).toBe('me');
      expect(prisma.ptSession.create.mock.calls[0][0].data.trainerId).toBe('me');
    });
  });

  describe('complete', () => {
    it('marks SCHEDULED → COMPLETED with feedback and a clamped rating', async () => {
      prisma.ptSession.findUnique.mockResolvedValue(mockSession);
      prisma.ptSession.update.mockResolvedValue({ ...mockSession, status: 'COMPLETED' });
      await service.complete('sess-001', 'Good', 9);
      expect(prisma.ptSession.update.mock.calls[0][0].data).toMatchObject({ status: 'COMPLETED', feedback: 'Good', rating: 5, completedAt: expect.any(Date) });
    });

    it('refuses when not SCHEDULED', async () => {
      prisma.ptSession.findUnique.mockResolvedValue({ ...mockSession, status: 'CANCELLED' });
      await expect(service.complete('sess-001')).rejects.toThrow(BadRequestException);
    });

    it('a trainer may only complete their own sessions', async () => {
      prisma.ptSession.findUnique.mockResolvedValue(mockSession);
      await expect(service.complete('sess-001', undefined, undefined, 'other-trainer')).rejects.toThrow(ForbiddenException);
    });

    it('404s on an unknown session', async () => {
      prisma.ptSession.findUnique.mockResolvedValue(null);
      await expect(service.complete('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('cancels a scheduled session', async () => {
      prisma.ptSession.findUnique.mockResolvedValue(mockSession);
      prisma.ptSession.update.mockResolvedValue({});
      await service.cancel('sess-001');
      expect(prisma.ptSession.update).toHaveBeenCalledWith({ where: { id: 'sess-001' }, data: { status: 'CANCELLED' } });
    });

    it('cannot cancel a completed session', async () => {
      prisma.ptSession.findUnique.mockResolvedValue({ ...mockSession, status: 'COMPLETED' });
      await expect(service.cancel('sess-001')).rejects.toThrow(BadRequestException);
    });
  });

  it('getStats computes completion rate', async () => {
    prisma.ptSession.count
      .mockResolvedValueOnce(10).mockResolvedValueOnce(2).mockResolvedValueOnce(7)
      .mockResolvedValueOnce(1).mockResolvedValueOnce(4);
    const res = await service.getStats('trainer-001', 'gym-001');
    expect(res).toEqual({ total: 10, scheduled: 2, completed: 7, cancelled: 1, thisWeek: 4, completionRate: 70 });
  });

  it('getStats reports 0% when there are no sessions', async () => {
    prisma.ptSession.count.mockResolvedValue(0);
    const res = await service.getStats('trainer-001', 'gym-001');
    expect(res.completionRate).toBe(0);
  });
});

// ─── NotificationsService ────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: ReturnType<typeof makePrisma>;
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined), sendToGym: jest.fn().mockResolvedValue(undefined) };
  const mockNotif = { id: 'notif-001', userId: 'user-001', title: 'Hi', message: 'There', isRead: false };

  beforeEach(async () => {
    prisma = makePrisma();
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: push },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  it('findAll returns a page with a cursor when more remain', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ ...mockNotif, id: `n${i}` }));
    prisma.notification.findMany.mockResolvedValue(rows);
    const res = await service.findAll('user-001', { limit: 2 });
    expect(res.data).toHaveLength(2);
    expect(res.hasMore).toBe(true);
    expect(res.nextCursor).toBe('n1');
    expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: 'user-001' }, take: 3 });
  });

  it('findAll passes the cursor through and caps limit at 100', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    const res = await service.findAll('user-001', { limit: 500, cursor: 'n9' });
    expect(res).toEqual({ data: [], nextCursor: null, hasMore: false });
    expect(prisma.notification.findMany.mock.calls[0][0]).toMatchObject({ take: 101, cursor: { id: 'n9' }, skip: 1 });
  });

  describe('markAsRead', () => {
    it('marks the caller\'s own notification read', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotif);
      prisma.notification.update.mockResolvedValue({ ...mockNotif, isRead: true });
      await service.markAsRead('notif-001', 'user-001');
      expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 'notif-001' }, data: { isRead: true } });
    });

    it('refuses another user\'s notification', async () => {
      prisma.notification.findUnique.mockResolvedValue(mockNotif);
      await expect(service.markAsRead('notif-001', 'intruder')).rejects.toThrow(ForbiddenException);
    });

    it('404s when missing', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markAsRead('x', 'user-001')).rejects.toThrow(NotFoundException);
    });
  });

  it('create persists and fires a push to the target user', async () => {
    prisma.notification.create.mockResolvedValue(mockNotif);
    await service.create({ title: 'Hi', message: 'There', type: 'GENERAL', userId: 'user-001' });
    expect(push.sendToUser).toHaveBeenCalledWith('user-001', { title: 'Hi', body: 'There' }, expect.objectContaining({ notificationId: 'notif-001' }));
  });

  it('create without userId does not push', async () => {
    prisma.notification.create.mockResolvedValue(mockNotif);
    await service.create({ title: 'Hi', message: 'There', type: 'GENERAL', gymId: 'gym-001' });
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  describe('broadcast', () => {
    it('rejects an empty title or message', async () => {
      await expect(service.broadcast('gym-001', { title: ' ', message: 'x', type: 'GENERAL' })).rejects.toThrow();
      await expect(service.broadcast('gym-001', { title: 'x', message: '', type: 'GENERAL' })).rejects.toThrow();
    });

    it('creates one IN_APP notification per active gym user, in batches of 50, then pushes to the gym', async () => {
      const users = Array.from({ length: 120 }, (_, i) => ({ id: `u${i}` }));
      prisma.user.findMany.mockResolvedValue(users);
      prisma.notification.createMany.mockImplementation(async ({ data }: any) => ({ count: data.length }));

      const res = await service.broadcast('gym-001', { title: 'Closed', message: 'Holiday', type: 'GENERAL' });

      expect(res.count).toBe(120);
      expect(prisma.notification.createMany).toHaveBeenCalledTimes(3);
      expect(prisma.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({ userId: 'u0', gymId: 'gym-001', channel: 'IN_APP' });
      expect(push.sendToGym).toHaveBeenCalledWith('gym-001', { title: 'Closed', body: 'Holiday' }, { type: 'GENERAL' });
    });
  });

  it('getUnreadCount counts unread for the user', async () => {
    prisma.notification.count.mockResolvedValue(4);
    await expect(service.getUnreadCount('user-001')).resolves.toBe(4);
    expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'user-001', isRead: false } });
  });
});

// ─── WorkoutPlansService ─────────────────────────────────────────────────────

describe('WorkoutPlansService', () => {
  let service: WorkoutPlansService;
  let prisma: ReturnType<typeof makePrisma>;
  const notifications = { create: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    prisma = makePrisma();
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutPlansService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get(WorkoutPlansService);
  });

  it('findByUser returns [] when the user has no member profile in the gym', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.findByUser('user-001', 'gym-001')).resolves.toEqual([]);
    expect(prisma.workoutAssignment.findMany).not.toHaveBeenCalled();
  });

  it('findByUser returns active assignments with the plan', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'member-001' });
    prisma.workoutAssignment.findMany.mockResolvedValue([{ id: 'wa1', workoutPlan: { id: 'wp1' } }]);
    const res = await service.findByUser('user-001', 'gym-001');
    expect(res).toHaveLength(1);
    expect(prisma.workoutAssignment.findMany.mock.calls[0][0].where).toEqual({ memberId: 'member-001', gymId: 'gym-001', isActive: true });
  });

  it('generateAiPlan creates an AI-flagged plan, assigns it and notifies the member', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'member-001', userId: 'user-001' });
    prisma.workoutPlan.create.mockImplementation(async ({ data }: any) => ({ id: 'wp-ai', ...data }));
    prisma.workoutAssignment.create.mockResolvedValue({});

    const plan: any = await service.generateAiPlan('user-001', 'gym-001', 'Weight Loss', 'beginner');

    expect(plan).toMatchObject({ isAiGenerated: true, goal: 'Weight Loss', difficulty: 'BEGINNER', gymId: 'gym-001' });
    expect(Array.isArray(plan.exercises)).toBe(true);
    expect(prisma.workoutAssignment.create.mock.calls[0][0].data).toMatchObject({ workoutPlanId: 'wp-ai', memberId: 'member-001', gymId: 'gym-001', isActive: true });
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-001', gymId: 'gym-001', type: 'GENERAL' }));
  });

  it('generateAiPlan still returns a plan when the caller has no member profile (no assignment)', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    prisma.workoutPlan.create.mockImplementation(async ({ data }: any) => ({ id: 'wp-ai', ...data }));
    await service.generateAiPlan('user-001', 'gym-001', 'Strength', 'ADVANCED');
    expect(prisma.workoutAssignment.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
