import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatService, canChat, chattableRoles } from '../../../src/chat/chat.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockPrisma = {
  chatConversation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chatMessage: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  chatParticipant: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    aggregate: jest.fn(),
  },
  user: { findFirst: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
};

const GYM = 'gym-001';
// Ids chosen so 'a-member' < 'z-trainer': the pair ordering is part of what is tested.
const MEMBER = { id: 'a-member', firstName: 'Mem', lastName: 'Ber', role: 'MEMBER', avatar: null, gymId: GYM };
const TRAINER = { id: 'z-trainer', firstName: 'Tra', lastName: 'Iner', role: 'TRAINER', avatar: null, gymId: GYM };
const OTHER_MEMBER = { id: 'b-member', firstName: 'Oth', lastName: 'Er', role: 'MEMBER', avatar: null, gymId: GYM };
const ADMIN = { id: 'c-admin', firstName: 'Ad', lastName: 'Min', role: 'GYM_ADMIN', avatar: null, gymId: GYM };

describe('chat permissions', () => {
  it('members cannot message other members', () => {
    expect(canChat('MEMBER', 'MEMBER')).toBe(false);
  });

  it.each([
    ['MEMBER', 'TRAINER'], ['MEMBER', 'STAFF'], ['MEMBER', 'GYM_ADMIN'],
    ['TRAINER', 'MEMBER'], ['TRAINER', 'STAFF'], ['TRAINER', 'GYM_ADMIN'], ['TRAINER', 'TRAINER'],
    ['STAFF', 'MEMBER'], ['STAFF', 'STAFF'], ['STAFF', 'GYM_ADMIN'],
    ['GYM_ADMIN', 'MEMBER'],
  ])('%s may message %s', (a, b) => {
    expect(canChat(a, b)).toBe(true);
  });

  // The super admin talks to gym admins on the SUPPORT thread and has no
  // business inside a gym's private messages.
  it.each(['MEMBER', 'TRAINER', 'STAFF', 'GYM_ADMIN'])('a super admin cannot direct-message a %s', (role) => {
    expect(canChat('SUPER_ADMIN', role)).toBe(false);
    expect(canChat(role, 'SUPER_ADMIN')).toBe(false);
  });

  it('lists the roles each role may start a chat with', () => {
    expect(chattableRoles('MEMBER')).toEqual(['TRAINER', 'STAFF', 'GYM_ADMIN']);
    expect(chattableRoles('TRAINER')).toEqual(['MEMBER', 'TRAINER', 'STAFF', 'GYM_ADMIN']);
    expect(chattableRoles('STAFF')).toEqual(['MEMBER', 'TRAINER', 'STAFF', 'GYM_ADMIN']);
    expect(chattableRoles('SUPER_ADMIN')).toEqual([]);
  });
});

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
  });

  const bothExist = (me: any, peer: any) =>
    mockPrisma.user.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve([me, peer].find((u) => u.id === where.id) ?? null),
    );

  /**
   * `listThreads` now queries conversations twice — once for DIRECT rows, once
   * (via `listGroups`) for GROUP rows. A flat `mockResolvedValue` would hand the
   * same rows to both and invent a group out of a direct thread, so the mock
   * dispatches on the `type` in the where clause the way Postgres would.
   */
  const mockConversations = ({ direct = [], groups = [] }: { direct?: any[]; groups?: any[] }) =>
    mockPrisma.chatConversation.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(where?.type === 'GROUP' ? groups : direct),
    );

  describe('listThreads', () => {
    it('returns only threads the caller is on', async () => {
      mockConversations({});
      await service.listThreads(GYM, MEMBER.id);

      const args = mockPrisma.chatConversation.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        gymId: GYM,
        type: 'DIRECT',
        OR: [{ userId: MEMBER.id }, { peerId: MEMBER.id }],
      });
      expect(args.take).toBe(200);
    });

    it('flattens each thread to the other person and that side’s unread count', async () => {
      const row = { id: 'c1', userId: MEMBER.id, peerId: TRAINER.id, user: MEMBER, peer: TRAINER, lastMessage: 'hi', lastMessageAt: new Date(0), unreadUser: 3, unreadAdmin: 9 };
      mockConversations({ direct: [row] });
      const [thread] = await service.listThreads(GYM, MEMBER.id);
      expect(thread.peer).toEqual(TRAINER);
      expect(thread.unread).toBe(3);

      mockConversations({ direct: [row] });
      const [asTrainer] = await service.listThreads(GYM, TRAINER.id);
      expect(asTrainer.peer).toEqual(MEMBER);
      expect(asTrainer.unread).toBe(9);
    });

    it('hides threads nobody has written in', async () => {
      mockConversations({
        direct: [{ id: 'c1', userId: MEMBER.id, peerId: TRAINER.id, user: MEMBER, peer: TRAINER, lastMessage: null, lastMessageAt: new Date(0), unreadUser: 0, unreadAdmin: 0 }],
      });
      expect(await service.listThreads(GYM, MEMBER.id)).toEqual([]);
    });

    // A group the admin just made has no messages yet, but it must still show —
    // unlike an empty direct thread, which is only noise.
    it('keeps a brand-new group in the inbox and sorts everything by recency', async () => {
      const older = new Date('2026-09-17T10:00:00Z');
      const newer = new Date('2026-09-18T10:00:00Z');
      mockConversations({
        direct: [{ id: 'c1', userId: MEMBER.id, peerId: TRAINER.id, user: MEMBER, peer: TRAINER, lastMessage: 'hi', lastMessageAt: older, unreadUser: 1, unreadAdmin: 0 }],
        groups: [{
          id: 'g1', name: 'Morning batch', avatar: null, lastMessage: null, lastMessageAt: newer,
          participants: [
            { userId: MEMBER.id, role: 'MEMBER', unread: 4, isActive: true, user: MEMBER },
            { userId: ADMIN.id, role: 'OWNER', unread: 0, isActive: true, user: ADMIN },
          ],
        }],
      });

      const threads = await service.listThreads(GYM, MEMBER.id);
      expect(threads.map((t) => t.id)).toEqual(['g1', 'c1']);
      expect(threads[0]).toMatchObject({ type: 'GROUP', name: 'Morning batch', unread: 4, participantCount: 2 });
      expect(threads[1]).toMatchObject({ type: 'DIRECT', unread: 1 });
    });
  });

  describe('unreadCount', () => {
    it('sums direct threads and group participation', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValue([
        { userId: MEMBER.id, unreadUser: 2, unreadAdmin: 99 },   // I am the user side → 2
        { userId: TRAINER.id, unreadUser: 99, unreadAdmin: 3 },  // I am the peer side → 3
      ]);
      mockPrisma.chatParticipant.aggregate.mockResolvedValue({ _sum: { unread: 5 } });
      expect(await service.unreadCount(GYM, MEMBER.id)).toBe(10);
    });

    it('treats no group rows as zero rather than NaN', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValue([]);
      mockPrisma.chatParticipant.aggregate.mockResolvedValue({ _sum: { unread: null } });
      expect(await service.unreadCount(GYM, MEMBER.id)).toBe(0);
    });
  });

  describe('opening a thread', () => {
    it('refuses member → member', async () => {
      bothExist(MEMBER, OTHER_MEMBER);
      await expect(service.getOrCreateDirect(GYM, MEMBER.id, OTHER_MEMBER.id)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.chatConversation.create).not.toHaveBeenCalled();
    });

    it('refuses someone outside the gym, without saying whether they exist', async () => {
      mockPrisma.user.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === MEMBER.id ? MEMBER : null),
      );
      await expect(service.getOrCreateDirect(GYM, MEMBER.id, 'someone-else')).rejects.toThrow(NotFoundException);
    });

    it('refuses messaging yourself', async () => {
      await expect(service.getOrCreateDirect(GYM, MEMBER.id, MEMBER.id)).rejects.toThrow(BadRequestException);
    });

    // Same pair, whichever side opens it: one row, ordered by id.
    it('stores the pair in a canonical order', async () => {
      bothExist(MEMBER, TRAINER);
      mockPrisma.chatConversation.findUnique.mockResolvedValue(null);
      mockPrisma.chatConversation.create.mockResolvedValue({ id: 'c1', userId: MEMBER.id, peerId: TRAINER.id, unreadUser: 0, unreadAdmin: 0 });

      await service.getOrCreateDirect(GYM, TRAINER.id, MEMBER.id);
      expect(mockPrisma.chatConversation.create.mock.calls[0][0].data).toEqual({
        gymId: GYM, userId: MEMBER.id, peerId: TRAINER.id, type: 'DIRECT',
      });
    });
  });

  describe('sending', () => {
    it('increments the unread of the side that did not send', async () => {
      bothExist(TRAINER, MEMBER);
      mockPrisma.chatConversation.findUnique.mockResolvedValue({ id: 'c1', userId: MEMBER.id, peerId: TRAINER.id });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'm1', sender: TRAINER });
      mockPrisma.chatConversation.update.mockResolvedValue({});

      await service.saveDirectMessage(GYM, TRAINER.id, MEMBER.id, 'hello');

      // The trainer is the peer side here, so the member's counter goes up.
      expect(mockPrisma.chatConversation.update.mock.calls[0][0].data).toMatchObject({
        unreadUser: { increment: 1 },
        unreadAdmin: 0,
      });
    });

    it('strips html from the message', async () => {
      bothExist(TRAINER, MEMBER);
      mockPrisma.chatConversation.findUnique.mockResolvedValue({ id: 'c1', userId: MEMBER.id, peerId: TRAINER.id });
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'm1', sender: TRAINER });
      mockPrisma.chatConversation.update.mockResolvedValue({});

      await service.saveDirectMessage(GYM, TRAINER.id, MEMBER.id, '<img src=x onerror=alert(1)>hi');
      expect(mockPrisma.chatMessage.create.mock.calls[0][0].data.content).toBe('hi');
    });

    it('refuses to deliver member → member', async () => {
      bothExist(MEMBER, OTHER_MEMBER);
      await expect(service.saveDirectMessage(GYM, MEMBER.id, OTHER_MEMBER.id, 'hi')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.chatMessage.create).not.toHaveBeenCalled();
    });
  });

  describe('marking read', () => {
    it('refuses a thread the caller is not on', async () => {
      mockPrisma.chatConversation.findUnique.mockResolvedValue({ id: 'c1', userId: MEMBER.id, peerId: TRAINER.id });
      await expect(service.markDirectRead(GYM, ADMIN.id, 'someone')).rejects.toThrow(ForbiddenException);
    });

    it('never marks the caller’s own messages as read', async () => {
      mockPrisma.chatConversation.findUnique.mockResolvedValue({ id: 'c1', userId: MEMBER.id, peerId: TRAINER.id });
      mockPrisma.chatConversation.update.mockResolvedValue({});
      mockPrisma.chatMessage.updateMany.mockResolvedValue({ count: 0 });

      await service.markDirectRead(GYM, MEMBER.id, TRAINER.id);
      expect(mockPrisma.chatMessage.updateMany.mock.calls[0][0].where.senderId).toEqual({ not: MEMBER.id });
    });
  });

  describe('contacts', () => {
    it('offers a member only trainers, staff and the admin', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await service.listContacts(GYM, MEMBER.id, 'MEMBER');
      const where = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(where.role).toEqual({ in: ['TRAINER', 'STAFF', 'GYM_ADMIN'] });
      expect(where.id).toEqual({ not: MEMBER.id });
      expect(where.gymId).toBe(GYM);
    });

    it('gives a super admin nobody', async () => {
      expect(await service.listContacts(GYM, 'sa', 'SUPER_ADMIN')).toEqual([]);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('groups', () => {
    const CONV = 'g1';
    const asParticipant = (role: 'OWNER' | 'MEMBER', isActive = true) =>
      mockPrisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV, userId: MEMBER.id, role, isActive });

    const groupExists = () =>
      mockPrisma.chatConversation.findFirst.mockResolvedValue({ id: CONV, gymId: GYM, type: 'GROUP', deletedAt: null });

    it('only a gym admin may create one', async () => {
      await expect(service.createGroup(GYM, MEMBER.id, 'MEMBER', 'Batch', [])).rejects.toThrow(ForbiddenException);
      await expect(service.createGroup(GYM, TRAINER.id, 'TRAINER', 'Batch', [])).rejects.toThrow(ForbiddenException);
      await expect(service.createGroup(GYM, 'sa', 'SUPER_ADMIN', 'Batch', [])).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.chatConversation.create).not.toHaveBeenCalled();
    });

    it('refuses a nameless group and strips html from the name', async () => {
      await expect(service.createGroup(GYM, ADMIN.id, 'GYM_ADMIN', '   ', [])).rejects.toThrow(BadRequestException);

      mockPrisma.user.findMany.mockResolvedValue([MEMBER]);
      mockPrisma.chatConversation.create.mockResolvedValue({ id: CONV, name: 'hi', avatar: null, lastMessage: null, lastMessageAt: new Date(0), participants: [] });
      await service.createGroup(GYM, ADMIN.id, 'GYM_ADMIN', '<b>hi</b>', [MEMBER.id]);
      expect(mockPrisma.chatConversation.create.mock.calls[0][0].data.name).toBe('hi');
    });

    it('makes the creator the owner and never adds them twice', async () => {
      mockPrisma.user.findMany.mockResolvedValue([MEMBER, TRAINER]);
      mockPrisma.chatConversation.create.mockResolvedValue({ id: CONV, name: 'Batch', avatar: null, lastMessage: null, lastMessageAt: new Date(0), participants: [] });

      // The creator is passed in the member list as well — a real client does this.
      await service.createGroup(GYM, ADMIN.id, 'GYM_ADMIN', 'Batch', [MEMBER.id, TRAINER.id, ADMIN.id]);

      const created = mockPrisma.chatConversation.create.mock.calls[0][0].data;
      expect(created).toMatchObject({ gymId: GYM, userId: ADMIN.id, peerId: null, type: 'GROUP' });
      expect(created.participants.create).toEqual([
        { userId: ADMIN.id, role: 'OWNER' },
        { userId: MEMBER.id, role: 'MEMBER' },
        { userId: TRAINER.id, role: 'MEMBER' },
      ]);
    });

    it('refuses people who are not active users of this gym', async () => {
      mockPrisma.user.findMany.mockResolvedValue([MEMBER]); // asked for two, found one
      await expect(
        service.createGroup(GYM, ADMIN.id, 'GYM_ADMIN', 'Batch', [MEMBER.id, 'outsider']),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.chatConversation.create).not.toHaveBeenCalled();
    });

    it('refuses to read or post for a non-participant', async () => {
      groupExists();
      mockPrisma.chatParticipant.findUnique.mockResolvedValue(null);
      await expect(service.getGroupMessages(GYM, MEMBER.id, CONV)).rejects.toThrow(ForbiddenException);
      await expect(service.saveGroupMessage(GYM, MEMBER.id, CONV, 'hi')).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it('refuses someone who left, even though their row still exists', async () => {
      groupExists();
      asParticipant('MEMBER', false);
      await expect(service.saveGroupMessage(GYM, MEMBER.id, CONV, 'hi')).rejects.toThrow(ForbiddenException);
    });

    it('refuses a group id from another gym', async () => {
      mockPrisma.chatConversation.findFirst.mockResolvedValue(null);
      await expect(service.getGroupMessages(GYM, MEMBER.id, CONV)).rejects.toThrow(NotFoundException);
    });

    // A plain member may post: inside a room the gate is membership, not the
    // role pair that blocks member → member direct messages.
    it('lets any active participant post, and fans unread out to everyone else', async () => {
      groupExists();
      asParticipant('MEMBER');
      mockPrisma.chatMessage.create.mockResolvedValue({ id: 'm1', sender: MEMBER });
      mockPrisma.chatParticipant.findMany.mockResolvedValue([
        { userId: MEMBER.id }, { userId: TRAINER.id }, { userId: ADMIN.id },
      ]);

      const result = await service.saveGroupMessage(GYM, MEMBER.id, CONV, '<i>hello</i>');

      expect(mockPrisma.chatMessage.create.mock.calls[0][0].data.content).toBe('hello');
      expect(mockPrisma.chatParticipant.updateMany.mock.calls[0][0]).toEqual({
        where: { conversationId: CONV, isActive: true, userId: { not: MEMBER.id } },
        data: { unread: { increment: 1 } },
      });
      expect(result.recipientIds).toEqual([MEMBER.id, TRAINER.id, ADMIN.id]);
    });

    it('lets only the owner rename, add and remove', async () => {
      groupExists();
      asParticipant('MEMBER');
      await expect(service.renameGroup(GYM, MEMBER.id, CONV, 'New')).rejects.toThrow(ForbiddenException);
      await expect(service.addParticipants(GYM, MEMBER.id, CONV, [TRAINER.id])).rejects.toThrow(ForbiddenException);
      await expect(service.removeParticipant(GYM, MEMBER.id, CONV, TRAINER.id)).rejects.toThrow(ForbiddenException);
      await expect(service.deleteGroup(GYM, MEMBER.id, CONV)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.chatConversation.update).not.toHaveBeenCalled();
    });

    it('re-adding someone who left flips their row back on instead of colliding', async () => {
      groupExists();
      mockPrisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV, userId: ADMIN.id, role: 'OWNER', isActive: true });
      mockPrisma.user.findMany.mockResolvedValue([TRAINER]);
      mockPrisma.chatConversation.findUnique.mockResolvedValue({ id: CONV, name: 'Batch', avatar: null, lastMessage: null, lastMessageAt: new Date(0), participants: [] });

      await service.addParticipants(GYM, ADMIN.id, CONV, [TRAINER.id]);

      const call = mockPrisma.chatParticipant.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ conversationId_userId: { conversationId: CONV, userId: TRAINER.id } });
      expect(call.update).toMatchObject({ isActive: true, unread: 0 });
      expect(call.create).toMatchObject({ conversationId: CONV, userId: TRAINER.id, role: 'MEMBER' });
    });

    it('stops the owner removing or walking out on themselves', async () => {
      groupExists();
      mockPrisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV, userId: ADMIN.id, role: 'OWNER', isActive: true });
      await expect(service.removeParticipant(GYM, ADMIN.id, CONV, ADMIN.id)).rejects.toThrow(BadRequestException);
      await expect(service.leaveGroup(GYM, ADMIN.id, CONV)).rejects.toThrow(BadRequestException);
    });

    it('lets a non-owner leave', async () => {
      groupExists();
      asParticipant('MEMBER');
      mockPrisma.chatParticipant.update.mockResolvedValue({});
      expect(await service.leaveGroup(GYM, MEMBER.id, CONV)).toEqual({ left: true });
      expect(mockPrisma.chatParticipant.update.mock.calls[0][0].data).toEqual({ isActive: false });
    });
  });

  describe('getAllSupportConversations', () => {
    it('caps the platform-wide support list with a take limit', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValue([]);
      await service.getAllSupportConversations();

      const args = mockPrisma.chatConversation.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ type: 'SUPPORT' });
      expect(args.take).toBe(200);
    });
  });
});
