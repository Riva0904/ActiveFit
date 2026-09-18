import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml: (html: string, opts?: any) => string = require('sanitize-html');

const MAX_MESSAGE_LENGTH = 4000;
const ALLOWED_EMOJI_REGEX = /^\p{Emoji}$/u;

const GYM_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
};

const MSG_INCLUDE = {
  sender: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
};

const PERSON = { id: true, firstName: true, lastName: true, role: true, avatar: true } as const;

const DIRECT_INCLUDE = {
  user: { select: PERSON },
  peer: { select: PERSON },
};

/**
 * Who may open a chat with whom, inside one gym.
 *
 * Members are the only role that cannot reach their own kind: member ↔ member
 * is off so the app never becomes a member directory. Everyone else may reach
 * everyone, which is what makes a trainer's or the front desk's job possible.
 *
 * A super admin is not in this table at all — they have the SUPPORT thread with
 * each gym admin and no business inside a gym's private messages.
 */
export function canChat(a?: string | null, b?: string | null): boolean {
  const CHATTABLE = ['MEMBER', 'TRAINER', 'STAFF', 'GYM_ADMIN'];
  if (!a || !b) return false;
  if (!CHATTABLE.includes(a) || !CHATTABLE.includes(b)) return false;
  if (a === 'MEMBER' && b === 'MEMBER') return false;
  return true;
}

/** Roles a given role is allowed to start a conversation with. */
export function chattableRoles(role: string): string[] {
  return ['MEMBER', 'TRAINER', 'STAFF', 'GYM_ADMIN'].filter((other) => canChat(role, other));
}

/**
 * A pair always maps to one row: the smaller id is stored as `userId`, the
 * larger as `peerId`. Without this, A→B and B→A would create two threads and
 * each side would see half the conversation.
 */
function pairKey(x: string, y: string) {
  return x < y ? { userId: x, peerId: y } : { userId: y, peerId: x };
}

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // ─── Attachments (stored as bytes in Postgres) ────────────────────────────

  async uploadAttachment(buffer: Buffer, mimeType: string, fileName: string) {
    return this.prisma.chatAttachment.create({
      data: { data: buffer, mimeType, fileName, fileSize: buffer.length },
    });
  }

  async getAttachment(id: string) {
    return this.prisma.chatAttachment.findUnique({ where: { id } });
  }

  // ─── DIRECT conversations (private, 1:1, inside one gym) ─────────────────

  /** The two people, checked to be in the same gym and allowed to talk. */
  private async participants(gymId: string, meId: string, peerId: string) {
    if (meId === peerId) throw new BadRequestException('You cannot message yourself');
    const [me, peer] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: meId, gymId }, select: { ...PERSON, gymId: true } }),
      this.prisma.user.findFirst({ where: { id: peerId, gymId, isActive: true }, select: { ...PERSON, gymId: true } }),
    ]);
    // "Not in this gym" and "not allowed to talk" are the same answer on
    // purpose: neither tells the caller whether the other person exists.
    if (!me || !peer) throw new NotFoundException('Person not found in this gym');
    if (!canChat(me.role, peer.role)) throw new ForbiddenException('You cannot message this person');
    return { me, peer };
  }

  /** Everyone in the gym this user may start a conversation with. */
  async listContacts(gymId: string, meId: string, meRole: string, search?: string) {
    const roles = chattableRoles(meRole);
    if (roles.length === 0) return [];

    const q = (search ?? '').trim();
    const people = await this.prisma.user.findMany({
      where: {
        gymId,
        isActive: true,
        id: { not: meId },
        role: { in: roles as any },
        ...(q && {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }),
      },
      select: { ...PERSON, member: { select: { memberCode: true } } },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      take: 200,
    });

    return people.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      role: p.role,
      avatar: p.avatar,
      memberCode: p.member?.memberCode ?? null,
    }));
  }

  /**
   * My inbox: 1:1 threads and the groups I am in, newest activity first. Direct
   * rows are flattened to "the other person"; group rows carry a name instead of
   * a peer, and the client tells them apart by `type`.
   */
  async listThreads(gymId: string, meId: string) {
    const [convs, groups] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where: {
          gymId,
          type: 'DIRECT',
          // A thread is mine only if I am one of its two sides. This is the whole
          // privacy fix: staff no longer read the admin's threads, because they
          // are not on them.
          OR: [{ userId: meId }, { peerId: meId }],
        },
        include: DIRECT_INCLUDE,
        orderBy: { lastMessageAt: 'desc' },
        take: 200,
      }),
      this.listGroups(gymId, meId),
    ]);

    const direct = convs
      .filter((c) => c.lastMessage !== null) // never-used threads are noise
      .map((c) => {
        const iAmUser = c.userId === meId;
        const other = iAmUser ? c.peer : c.user;
        return {
          id: c.id,
          type: 'DIRECT' as const,
          peer: other,
          name: null as string | null,
          lastMessage: c.lastMessage,
          lastMessageAt: c.lastMessageAt,
          unread: iAmUser ? c.unreadUser : c.unreadAdmin,
        };
      });

    // A brand-new group is kept even with no messages: the admin just made it and
    // must be able to find it. An empty *direct* thread is only noise.
    const grouped = groups.map((g) => ({
      id: g.id,
      type: 'GROUP' as const,
      peer: null,
      name: g.name,
      avatar: g.avatar,
      lastMessage: g.lastMessage,
      lastMessageAt: g.lastMessageAt,
      unread: g.unread,
      participantCount: g.participantCount,
      isOwner: g.isOwner,
    }));

    return [...direct, ...grouped].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
  }

  async getOrCreateDirect(gymId: string, meId: string, peerId: string) {
    const { peer } = await this.participants(gymId, meId, peerId);
    const key = pairKey(meId, peerId);

    const conv =
      (await this.prisma.chatConversation.findUnique({
        where: { gymId_userId_peerId_type: { gymId, ...key, type: 'DIRECT' } },
        include: DIRECT_INCLUDE,
      })) ??
      (await this.prisma.chatConversation.create({
        data: { gymId, ...key, type: 'DIRECT' },
        include: DIRECT_INCLUDE,
      }));

    return { id: conv.id, peer, unread: conv.userId === meId ? conv.unreadUser : conv.unreadAdmin };
  }

  async getDirectMessages(gymId: string, meId: string, peerId: string, take = 50, skip = 0) {
    await this.participants(gymId, meId, peerId);
    const conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_peerId_type: { gymId, ...pairKey(meId, peerId), type: 'DIRECT' } },
    });
    if (!conv) return [];
    return this.prisma.chatMessage.findMany({
      where: { conversationId: conv.id, isDeleted: false },
      include: MSG_INCLUDE,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async saveDirectMessage(
    gymId: string,
    senderId: string,
    peerId: string,
    content: string,
    attachment?: { url: string; name: string; type: string },
  ) {
    await this.participants(gymId, senderId, peerId);
    const safeContent = sanitizeHtml(content ?? '', { allowedTags: [], allowedAttributes: {} }).slice(0, MAX_MESSAGE_LENGTH);
    const key = pairKey(senderId, peerId);

    const conv =
      (await this.prisma.chatConversation.findUnique({
        where: { gymId_userId_peerId_type: { gymId, ...key, type: 'DIRECT' } },
      })) ??
      (await this.prisma.chatConversation.create({ data: { gymId, ...key, type: 'DIRECT' } }));

    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId,
        content: safeContent,
        ...(attachment && {
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
        }),
      },
      include: MSG_INCLUDE,
    });

    // The unread counter belongs to the side that did not send.
    const senderIsUserSide = conv.userId === senderId;
    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: {
        lastMessage: attachment ? `📎 ${attachment.name}` : safeContent,
        lastMessageAt: new Date(),
        unreadUser: senderIsUserSide ? 0 : { increment: 1 },
        unreadAdmin: senderIsUserSide ? { increment: 1 } : 0,
      },
    });

    return { message: msg, conversationId: conv.id, peerId };
  }

  async markDirectRead(gymId: string, meId: string, peerId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { gymId_userId_peerId_type: { gymId, ...pairKey(meId, peerId), type: 'DIRECT' } },
    });
    if (!conv) return;
    if (conv.userId !== meId && conv.peerId !== meId) throw new ForbiddenException('Not your conversation');

    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: conv.userId === meId ? { unreadUser: 0 } : { unreadAdmin: 0 },
    });
    await this.prisma.chatMessage.updateMany({
      where: { conversationId: conv.id, isRead: false, senderId: { not: meId } },
      data: { isRead: true },
    });
  }

  /** Total unread across my direct threads and my groups — drives the tab badge. */
  async unreadCount(gymId: string, meId: string) {
    const [convs, groups] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where: { gymId, type: 'DIRECT', OR: [{ userId: meId }, { peerId: meId }] },
        select: { userId: true, unreadUser: true, unreadAdmin: true },
      }),
      this.prisma.chatParticipant.aggregate({
        where: { userId: meId, isActive: true, conversation: { gymId, type: 'GROUP', deletedAt: null } },
        _sum: { unread: true },
      }),
    ]);
    const directUnread = convs.reduce((sum, c) => sum + (c.userId === meId ? c.unreadUser : c.unreadAdmin), 0);
    return directUnread + (groups._sum.unread ?? 0);
  }

  // ─── SUPPORT conversations (gym admin ↔ super admin) ─────────────────────

  async getOrCreateSupportConversation(gymId: string, gymAdminId: string) {
    // findFirst, not findUnique: a SUPPORT thread has no peer, and the
    // uniqueness of (gym, user, type) among peer-less rows is enforced by a
    // partial index rather than by the compound unique key.
    let conv = await this.prisma.chatConversation.findFirst({
      where: { gymId, userId: gymAdminId, type: 'SUPPORT' },
      include: {
        ...GYM_INCLUDE,
        gym: { select: { id: true, name: true, logo: true } },
      },
    });
    if (!conv) {
      conv = await this.prisma.chatConversation.create({
        data: { gymId, userId: gymAdminId, type: 'SUPPORT' },
        include: {
          ...GYM_INCLUDE,
          gym: { select: { id: true, name: true, logo: true } },
        },
      });
    }
    return conv;
  }

  async getAllSupportConversations() {
    return this.prisma.chatConversation.findMany({
      where: { type: 'SUPPORT' },
      include: {
        ...GYM_INCLUDE,
        gym: { select: { id: true, name: true, logo: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Every gym as a potential support thread, whether or not one exists yet.
   *
   * `getAllSupportConversations` only returns rows that already exist, so a gym
   * that never wrote in was unreachable from the UI even though the socket would
   * happily create the thread on first send. This lists the gyms instead and
   * attaches the thread when there is one.
   */
  async listSupportTargets(search?: string) {
    const q = (search ?? '').trim();
    const gyms = await this.prisma.gym.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { city: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        logo: true,
        city: true,
        // The oldest active admin is the desk's counterpart, matching how the
        // direct-chat backfill picked one.
        users: {
          where: { role: 'GYM_ADMIN', isActive: true },
          select: { id: true, firstName: true, lastName: true, avatar: true, role: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        chatConversations: {
          where: { type: 'SUPPORT' },
          select: { id: true, userId: true, lastMessage: true, lastMessageAt: true, unreadAdmin: true },
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
      take: 200,
    });

    return gyms
      // A gym with no active admin has nobody to talk to; showing it would open
      // a thread that can never be answered.
      .filter((g) => g.users.length > 0)
      .map((g) => {
        const admin = g.users[0];
        // Only a thread belonging to *this* admin counts; an old one from a
        // replaced admin is not their inbox.
        const conv = g.chatConversations.find((c) => c.userId === admin.id) ?? null;
        return {
          gymId: g.id,
          gymName: g.name,
          gymLogo: g.logo,
          city: g.city,
          admin,
          conversationId: conv?.id ?? null,
          lastMessage: conv?.lastMessage ?? null,
          lastMessageAt: conv?.lastMessageAt ?? null,
          unread: conv?.unreadAdmin ?? 0,
        };
      })
      .sort((a, b) => {
        // Gyms with unread first, then by recency, then never-contacted by name.
        if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return b.unread - a.unread;
        const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        if (at !== bt) return bt - at;
        return a.gymName.localeCompare(b.gymName);
      });
  }

  async getSupportMessages(gymId: string, gymAdminId: string, take = 50, skip = 0) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: { gymId, userId: gymAdminId, type: 'SUPPORT' },
    });
    if (!conv) return [];
    return this.prisma.chatMessage.findMany({
      where: { conversationId: conv.id, isDeleted: false },
      include: MSG_INCLUDE,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async saveSupportMessage(
    gymId: string,
    gymAdminId: string,
    senderId: string,
    content: string,
    attachment?: { url: string; name: string; type: string },
  ) {
    const safeContent = sanitizeHtml(content ?? '', { allowedTags: [], allowedAttributes: {} }).slice(0, MAX_MESSAGE_LENGTH);

    const conv = await this.getOrCreateSupportConversation(gymId, gymAdminId);
    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        senderId,
        content: safeContent,
        ...(attachment && {
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
        }),
      },
      include: MSG_INCLUDE,
    });
    // unreadAdmin = unread for SuperAdmin, unreadUser = unread for GymAdmin
    const isSuperAdmin = msg.sender.role === 'SUPER_ADMIN';
    const preview = attachment ? `📎 ${attachment.name}` : content;
    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: {
        lastMessage: preview,
        lastMessageAt: new Date(),
        unreadAdmin: isSuperAdmin ? 0 : { increment: 1 },
        unreadUser: isSuperAdmin ? { increment: 1 } : 0,
      },
    });
    return msg;
  }

  async markSupportRead(gymId: string, gymAdminId: string, readerIsSuperAdmin: boolean) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: { gymId, userId: gymAdminId, type: 'SUPPORT' },
    });
    if (!conv) return;
    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: readerIsSuperAdmin ? { unreadAdmin: 0 } : { unreadUser: 0 },
    });
    await this.prisma.chatMessage.updateMany({
      where: { conversationId: conv.id, isRead: false },
      data: { isRead: true },
    });
  }

  // ─── GROUP conversations (many-to-many, inside one gym) ──────────────────

  /**
   * A group is a ChatConversation with `peerId: null`, `userId` = its creator,
   * and its people in `chat_participants`. Reusing the conversation row means
   * messages, attachments, reactions and soft-delete all keep working unchanged.
   *
   * Note the deliberate difference from `canChat`: member ↔ member is blocked for
   * direct messages so the app never becomes a member directory, but inside a
   * group everyone talks to everyone — that is what a group is. The gate is
   * therefore membership of the room, not the pair of roles.
   */
  private async assertGroup(conversationId: string, gymId: string) {
    const conv = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, gymId, type: 'GROUP', deletedAt: null },
    });
    if (!conv) throw new NotFoundException('Group not found');
    return conv;
  }

  /** The caller's participant row, or 403. `requireOwner` gates the admin actions. */
  private async assertParticipant(conversationId: string, userId: string, requireOwner = false) {
    const part = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!part || !part.isActive) throw new ForbiddenException('You are not in this group');
    if (requireOwner && part.role !== 'OWNER') throw new ForbiddenException('Only the group owner can do that');
    return part;
  }

  /** Every id must be an active user of the same gym — silently dropping strangers would hide a bug. */
  private async validateMemberIds(gymId: string, userIds: string[]) {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return [];
    const found = await this.prisma.user.findMany({
      where: { id: { in: unique }, gymId, isActive: true },
      select: { id: true },
    });
    if (found.length !== unique.length) throw new BadRequestException('One or more people are not active members of this gym');
    return unique;
  }

  async createGroup(gymId: string, creatorId: string, creatorRole: string, name: string, memberIds: string[]) {
    if (creatorRole !== 'GYM_ADMIN') throw new ForbiddenException('Only a gym admin can create a group');
    const safeName = sanitizeHtml(name ?? '', { allowedTags: [], allowedAttributes: {} }).trim().slice(0, 80);
    if (!safeName) throw new BadRequestException('A group needs a name');

    const ids = await this.validateMemberIds(gymId, memberIds.filter((id) => id !== creatorId));

    const conv = await this.prisma.chatConversation.create({
      data: {
        gymId,
        userId: creatorId,
        peerId: null,
        type: 'GROUP',
        name: safeName,
        lastMessageAt: new Date(),
        participants: {
          create: [
            { userId: creatorId, role: 'OWNER' },
            ...ids.map((userId) => ({ userId, role: 'MEMBER' as const })),
          ],
        },
      },
      include: { participants: { include: { user: { select: PERSON } } } },
    });

    return this.shapeGroup(conv, creatorId);
  }

  private shapeGroup(
    conv: { id: string; name: string | null; avatar: string | null; lastMessage: string | null; lastMessageAt: Date; participants?: any[] },
    meId: string,
  ) {
    const participants = (conv.participants ?? []).filter((p) => p.isActive);
    const mine = participants.find((p) => p.userId === meId);
    return {
      id: conv.id,
      type: 'GROUP' as const,
      name: conv.name,
      avatar: conv.avatar,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      unread: mine?.unread ?? 0,
      isOwner: mine?.role === 'OWNER',
      participantCount: participants.length,
      participants: participants.map((p) => ({ ...p.user, role: p.user.role, groupRole: p.role })),
    };
  }

  /** Groups I am in, newest activity first. */
  async listGroups(gymId: string, meId: string) {
    const convs = await this.prisma.chatConversation.findMany({
      where: {
        gymId,
        type: 'GROUP',
        deletedAt: null,
        participants: { some: { userId: meId, isActive: true } },
      },
      include: { participants: { include: { user: { select: PERSON } } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    return convs.map((c) => this.shapeGroup(c, meId));
  }

  async getGroup(gymId: string, meId: string, conversationId: string) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, meId);
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { participants: { include: { user: { select: PERSON } } } },
    });
    return this.shapeGroup(conv!, meId);
  }

  async getGroupMessages(gymId: string, meId: string, conversationId: string, take = 50, skip = 0) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, meId);
    return this.prisma.chatMessage.findMany({
      where: { conversationId, isDeleted: false },
      include: MSG_INCLUDE,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    });
  }

  async saveGroupMessage(
    gymId: string,
    senderId: string,
    conversationId: string,
    content: string,
    attachment?: { url: string; name: string; type: string },
  ) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, senderId);
    const safeContent = sanitizeHtml(content ?? '', { allowedTags: [], allowedAttributes: {} }).slice(0, MAX_MESSAGE_LENGTH);

    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId,
        content: safeContent,
        ...(attachment && {
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
        }),
      },
      include: MSG_INCLUDE,
    });

    // Unread fans out to everyone still in the room except the sender.
    await this.prisma.$transaction([
      this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: { lastMessage: attachment ? `📎 ${attachment.name}` : safeContent, lastMessageAt: new Date() },
      }),
      this.prisma.chatParticipant.updateMany({
        where: { conversationId, isActive: true, userId: { not: senderId } },
        data: { unread: { increment: 1 } },
      }),
    ]);

    const recipients = await this.prisma.chatParticipant.findMany({
      where: { conversationId, isActive: true },
      select: { userId: true },
    });

    return { message: msg, conversationId, recipientIds: recipients.map((r) => r.userId) };
  }

  async markGroupRead(gymId: string, meId: string, conversationId: string) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, meId);
    await this.prisma.chatParticipant.update({
      where: { conversationId_userId: { conversationId, userId: meId } },
      data: { unread: 0, lastReadAt: new Date() },
    });
  }

  async renameGroup(gymId: string, meId: string, conversationId: string, name: string) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, meId, true);
    const safeName = sanitizeHtml(name ?? '', { allowedTags: [], allowedAttributes: {} }).trim().slice(0, 80);
    if (!safeName) throw new BadRequestException('A group needs a name');
    await this.prisma.chatConversation.update({ where: { id: conversationId }, data: { name: safeName } });
    return this.getGroup(gymId, meId, conversationId);
  }

  async addParticipants(gymId: string, meId: string, conversationId: string, userIds: string[]) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, meId, true);
    const ids = await this.validateMemberIds(gymId, userIds);

    // Re-adding someone who left flips their row back on rather than colliding
    // with the (conversationId, userId) unique key.
    for (const userId of ids) {
      await this.prisma.chatParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        update: { isActive: true, unread: 0, joinedAt: new Date() },
        create: { conversationId, userId, role: 'MEMBER' },
      });
    }
    return this.getGroup(gymId, meId, conversationId);
  }

  async removeParticipant(gymId: string, meId: string, conversationId: string, userId: string) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, meId, true);
    if (userId === meId) throw new BadRequestException('The owner cannot remove themselves — delete the group instead');
    await this.prisma.chatParticipant.updateMany({
      where: { conversationId, userId },
      data: { isActive: false },
    });
    return this.getGroup(gymId, meId, conversationId);
  }

  /** Anyone but the owner can walk out; the owner deletes the group instead. */
  async leaveGroup(gymId: string, meId: string, conversationId: string) {
    await this.assertGroup(conversationId, gymId);
    const part = await this.assertParticipant(conversationId, meId);
    if (part.role === 'OWNER') throw new BadRequestException('The owner cannot leave — delete the group instead');
    await this.prisma.chatParticipant.update({
      where: { conversationId_userId: { conversationId, userId: meId } },
      data: { isActive: false },
    });
    return { left: true };
  }

  async deleteGroup(gymId: string, meId: string, conversationId: string) {
    await this.assertGroup(conversationId, gymId);
    await this.assertParticipant(conversationId, meId, true);
    const recipients = await this.prisma.chatParticipant.findMany({
      where: { conversationId, isActive: true },
      select: { userId: true },
    });
    await this.prisma.chatConversation.update({ where: { id: conversationId }, data: { deletedAt: new Date() } });
    return { deleted: true, recipientIds: recipients.map((r) => r.userId) };
  }

  /** Every group id the user is still in — the gateway joins a room per id. */
  async groupIdsFor(userId: string) {
    const rows = await this.prisma.chatParticipant.findMany({
      where: { userId, isActive: true, conversation: { type: 'GROUP', deletedAt: null } },
      select: { conversationId: true },
    });
    return rows.map((r) => r.conversationId);
  }

  // ─── Shared (delete & react work on any conversation) ────────────────────

  async deleteMessage(messageId: string, requesterId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) return null;
    if (message.senderId !== requesterId) return null;

    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, content: '' },
    });

    return {
      messageId,
      conversationId: message.conversationId,
      conversationUserId: message.conversation.userId,
      conversationPeerId: message.conversation.peerId,
      gymId: message.conversation.gymId,
      conversationType: message.conversation.type,
    };
  }

  async addReaction(messageId: string, userId: string, userName: string, emoji: string) {
    if (!ALLOWED_EMOJI_REGEX.test(emoji)) return null; // reject non-emoji strings

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message) return null;

    const reactions = (Array.isArray(message.reactions) ? message.reactions : []) as any[];
    const existingIdx = reactions.findIndex((r: any) => r.userId === userId && r.emoji === emoji);

    if (existingIdx >= 0) {
      reactions.splice(existingIdx, 1);
    } else {
      reactions.push({ emoji, userId, userName });
    }

    await this.prisma.chatMessage.update({ where: { id: messageId }, data: { reactions } });
    return {
      messageId,
      reactions,
      conversationId: message.conversationId,
      conversationUserId: message.conversation.userId,
      conversationPeerId: message.conversation.peerId,
      gymId: message.conversation.gymId,
      conversationType: message.conversation.type,
    };
  }
}
