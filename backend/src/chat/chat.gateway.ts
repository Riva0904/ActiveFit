import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as cookieParse from 'cookie';

// CORS_ORIGIN is comma-separated (see main.ts) — split it the same way here, otherwise a
// multi-origin deployment matches neither origin and every socket handshake is refused.
const SOCKET_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean);

@WebSocketGateway({ cors: { origin: SOCKET_ORIGINS, credentials: true }, path: '/socket.io' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Prefer the explicit handshake token (split-domain deployments — the httpOnly
      // cookie is scoped to the Vercel proxy origin and never reaches this socket
      // origin). Fall back to the cookie for same-origin/local-dev setups.
      const cookies = cookieParse.parse(client.handshake.headers.cookie ?? '');
      const token = client.handshake.auth?.token ?? cookies['ab_token'];
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token, { secret: this.configService.get('JWT_SECRET') }) as any;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, gymId: true, role: true, firstName: true, lastName: true },
      });
      if (!user) { client.disconnect(); return; }
      // SUPER_ADMIN has no gymId — allow connection anyway
      if (!user.gymId && user.role !== 'SUPER_ADMIN') { client.disconnect(); return; }
      (client as any).user = user;

      client.join(`user:${user.id}`);
      if (user.role === 'GYM_ADMIN') {
        client.join(`gym-admins:${user.gymId}`);
      }
      if (user.role === 'SUPER_ADMIN') {
        client.join('super-admin');
      }
      // One room per group the user is still in, so a group message is a single
      // emit rather than a loop over every participant's personal room.
      if (user.gymId) {
        const groupIds = await this.chatService.groupIdsFor(user.id);
        for (const id of groupIds) client.join(`group:${id}`);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  // ─── Direct chat: private, 1:1, inside one gym ───────────────────────────
  //
  // A message is emitted to exactly two rooms — the sender's and the
  // recipient's. Nothing is broadcast to `gym-admins:` any more: that room is
  // what used to put every member's messages in front of the whole front desk.

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      toUserId?: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    },
  ) {
    const user = (client as any).user;
    const hasContent = !!payload?.content?.trim();
    const hasAttachment = !!payload?.attachmentUrl;
    if (!user?.gymId || (!hasContent && !hasAttachment)) return;
    if (!payload?.toUserId) return;

    try {
      const { message, peerId } = await this.chatService.saveDirectMessage(
        user.gymId,
        user.id,
        payload.toUserId,
        payload.content?.trim() ?? '',
        hasAttachment ? { url: payload.attachmentUrl!, name: payload.attachmentName ?? '', type: payload.attachmentType ?? '' } : undefined,
      );
      const envelope = { ...message, peerId: user.id, threadWith: user.id };
      this.server.to(`user:${peerId}`).emit('chat:message', envelope);
      this.server.to(`user:${user.id}`).emit('chat:message', { ...message, peerId, threadWith: peerId });
    } catch (e: any) {
      // The service throws for "not in this gym" and "may not message" — say so
      // rather than failing silently, so the UI can drop the thread.
      client.emit('chat:error', { message: e?.message ?? 'Failed to send message' });
    }
  }

  // ─── Group chat ───────────────────────────────────────────────────────────
  //
  // Authorization lives in the service (`saveGroupMessage` asserts the sender is
  // an active participant), so a socket that guessed a conversation id gets an
  // error back rather than a delivered message.

  @SubscribeMessage('chat:group-send')
  async handleGroupSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      conversationId?: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    },
  ) {
    const user = (client as any).user;
    const hasContent = !!payload?.content?.trim();
    const hasAttachment = !!payload?.attachmentUrl;
    if (!user?.gymId || !payload?.conversationId || (!hasContent && !hasAttachment)) return;

    try {
      const { message, conversationId, recipientIds } = await this.chatService.saveGroupMessage(
        user.gymId,
        user.id,
        payload.conversationId,
        payload.content?.trim() ?? '',
        hasAttachment ? { url: payload.attachmentUrl!, name: payload.attachmentName ?? '', type: payload.attachmentType ?? '' } : undefined,
      );
      const envelope = { ...message, conversationId };
      this.server.to(`group:${conversationId}`).emit('chat:group-message', envelope);
      // A participant who joined after connecting has not joined the socket room
      // yet; their personal room keeps the inbox badge correct until they
      // reconnect. Skip the sender, who already has the room copy.
      for (const id of recipientIds) {
        if (id !== user.id) this.server.to(`user:${id}`).emit('chat:group-inbox', { conversationId });
      }
    } catch (e: any) {
      client.emit('chat:error', { message: e?.message ?? 'Failed to send group message' });
    }
  }

  @SubscribeMessage('chat:group-typing')
  handleGroupTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string },
  ) {
    const user = (client as any).user;
    if (!user?.gymId || !payload?.conversationId) return;
    // `client.to` excludes the sender; membership is implied by being in the room.
    client.to(`group:${payload.conversationId}`).emit('chat:group-typing', {
      conversationId: payload.conversationId,
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
    });
  }

  /**
   * Called by the owner's client after it created, renamed, or changed the
   * membership of a group. Everyone affected re-reads the group list; those
   * newly added also join the room without waiting for a reconnect.
   */
  @SubscribeMessage('chat:group-sync')
  async handleGroupSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId?: string; userIds?: string[] },
  ) {
    const user = (client as any).user;
    if (!user?.gymId || !payload?.conversationId) return;
    client.join(`group:${payload.conversationId}`);
    this.server.to(`group:${payload.conversationId}`).emit('chat:group-updated', { conversationId: payload.conversationId });
    for (const id of payload.userIds ?? []) {
      this.server.to(`user:${id}`).emit('chat:group-updated', { conversationId: payload.conversationId });
    }
  }

  // ─── SUPPORT chat: gym admin ↔ super admin ───────────────────────────────

  @SubscribeMessage('chat:support-send')
  async handleSupportSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      toGymAdminId?: string; // only used when sender is SUPER_ADMIN
      gymId?: string;        // only used when sender is SUPER_ADMIN
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    },
  ) {
    const user = (client as any).user;
    const hasContent = !!payload?.content?.trim();
    const hasAttachment = !!payload?.attachmentUrl;
    if (!hasContent && !hasAttachment) return;

    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isGymAdmin = user.role === 'GYM_ADMIN';
    if (!isSuperAdmin && !isGymAdmin) return;

    // Resolve gymId and gymAdminId for the conversation
    const gymId = isSuperAdmin ? payload.gymId : user.gymId;
    const gymAdminId = isSuperAdmin ? payload.toGymAdminId : user.id;
    if (!gymId || !gymAdminId) return;

    try {
      const msg = await this.chatService.saveSupportMessage(
        gymId,
        gymAdminId,
        user.id,
        payload.content?.trim() ?? '',
        hasAttachment ? { url: payload.attachmentUrl!, name: payload.attachmentName ?? '', type: payload.attachmentType ?? '' } : undefined,
      );
      // Deliver to gym admin's personal room and all super admin sockets
      this.server.to(`user:${gymAdminId}`).emit('chat:support-message', msg);
      this.server.to('super-admin').emit('chat:support-message', msg);
    } catch {
      client.emit('chat:error', { message: 'Failed to send support message' });
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:delete')
  async handleDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string },
  ) {
    const user = (client as any).user;
    if (!payload?.messageId) return;

    try {
      const result = await this.chatService.deleteMessage(payload.messageId, user.id);
      if (!result) return;
      const deletedPayload = { messageId: result.messageId };

      if (result.conversationType === 'SUPPORT') {
        this.server.to(`user:${result.conversationUserId}`).emit('chat:deleted', deletedPayload);
        this.server.to('super-admin').emit('chat:deleted', deletedPayload);
      } else if (result.conversationType === 'GROUP') {
        this.server.to(`group:${result.conversationId}`).emit('chat:deleted', deletedPayload);
      } else {
        // Only the two people on the thread.
        this.server.to(`user:${result.conversationUserId}`).emit('chat:deleted', deletedPayload);
        if (result.conversationPeerId) {
          this.server.to(`user:${result.conversationPeerId}`).emit('chat:deleted', deletedPayload);
        }
      }
    } catch { /* ignore */ }
  }

  // ─── React ────────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:react')
  async handleReact(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; emoji: string },
  ) {
    const user = (client as any).user;
    if (!payload?.messageId || !payload?.emoji) return;

    try {
      const result = await this.chatService.addReaction(
        payload.messageId, user.id, `${user.firstName} ${user.lastName}`, payload.emoji,
      );
      if (!result) return;
      const update = { messageId: result.messageId, reactions: result.reactions };

      if (result.conversationType === 'SUPPORT') {
        this.server.to(`user:${result.conversationUserId}`).emit('chat:reaction', update);
        this.server.to('super-admin').emit('chat:reaction', update);
      } else if (result.conversationType === 'GROUP') {
        this.server.to(`group:${result.conversationId}`).emit('chat:reaction', update);
      } else {
        this.server.to(`user:${result.conversationUserId}`).emit('chat:reaction', update);
        if (result.conversationPeerId) {
          this.server.to(`user:${result.conversationPeerId}`).emit('chat:reaction', update);
        }
      }
    } catch { /* ignore */ }
  }

  // ─── Typing ───────────────────────────────────────────────────────────────

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { toUserId?: string },
  ) {
    const user = (client as any).user;
    if (!user?.gymId || !payload?.toUserId) return;
    // Typing goes to the one person being typed at, never to a room.
    client.to(`user:${payload.toUserId}`).emit('chat:typing', { userId: user.id, role: user.role });
  }

  @SubscribeMessage('chat:support-typing')
  handleSupportTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { toGymAdminId?: string },
  ) {
    const user = (client as any).user;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isGymAdmin = user.role === 'GYM_ADMIN';
    if (!isSuperAdmin && !isGymAdmin) return;

    if (isSuperAdmin && payload?.toGymAdminId) {
      client.to(`user:${payload.toGymAdminId}`).emit('chat:support-typing', { userId: user.id, role: user.role });
    } else if (isGymAdmin) {
      client.to('super-admin').emit('chat:support-typing', { userId: user.id, role: user.role });
    }
  }
}
