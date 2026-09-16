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

  /** My threads, newest first, each already flattened to "the other person". */
  async listThreads(gymId: string, meId: string) {
    const convs = await this.prisma.chatConversation.findMany({
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
    });

    return convs
      .filter((c) => c.lastMessage !== null) // never-used threads are noise
      .map((c) => {
        const iAmUser = c.userId === meId;
        const other = iAmUser ? c.peer : c.user;
        return {
          id: c.id,
          peer: other,
          lastMessage: c.lastMessage,
          lastMessageAt: c.lastMessageAt,
          unread: iAmUser ? c.unreadUser : c.unreadAdmin,
        };
      });
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

  /** Total unread across my threads — drives the tab badge. */
  async unreadCount(gymId: string, meId: string) {
    const convs = await this.prisma.chatConversation.findMany({
      where: { gymId, type: 'DIRECT', OR: [{ userId: meId }, { peerId: meId }] },
      select: { userId: true, unreadUser: true, unreadAdmin: true },
    });
    return convs.reduce((sum, c) => sum + (c.userId === meId ? c.unreadUser : c.unreadAdmin), 0);
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
      conversationUserId: message.conversation.userId,
      conversationPeerId: message.conversation.peerId,
      gymId: message.conversation.gymId,
      conversationType: message.conversation.type,
    };
  }
}
