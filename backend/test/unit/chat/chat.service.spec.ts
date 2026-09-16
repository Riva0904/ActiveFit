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
  user: { findFirst: jest.fn(), findMany: jest.fn() },
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

  describe('listThreads', () => {
    it('returns only threads the caller is on', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValue([]);
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
      mockPrisma.chatConversation.findMany.mockResolvedValue([
        { id: 'c1', userId: MEMBER.id, peerId: TRAINER.id, user: MEMBER, peer: TRAINER, lastMessage: 'hi', lastMessageAt: new Date(0), unreadUser: 3, unreadAdmin: 9 },
      ]);
      const [thread] = await service.listThreads(GYM, MEMBER.id);
      expect(thread.peer).toEqual(TRAINER);
      expect(thread.unread).toBe(3);

      mockPrisma.chatConversation.findMany.mockResolvedValue([
        { id: 'c1', userId: MEMBER.id, peerId: TRAINER.id, user: MEMBER, peer: TRAINER, lastMessage: 'hi', lastMessageAt: new Date(0), unreadUser: 3, unreadAdmin: 9 },
      ]);
      const [asTrainer] = await service.listThreads(GYM, TRAINER.id);
      expect(asTrainer.peer).toEqual(MEMBER);
      expect(asTrainer.unread).toBe(9);
    });

    it('hides threads nobody has written in', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValue([
        { id: 'c1', userId: MEMBER.id, peerId: TRAINER.id, user: MEMBER, peer: TRAINER, lastMessage: null, lastMessageAt: new Date(0), unreadUser: 0, unreadAdmin: 0 },
      ]);
      expect(await service.listThreads(GYM, MEMBER.id)).toEqual([]);
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
