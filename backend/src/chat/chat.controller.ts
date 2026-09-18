import {
  Controller, Get, Patch, Post, Delete, Body, Param, Query, Req, UseGuards,
  ParseIntPipe, DefaultValuePipe, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ChatService } from './chat.service';
import { AddParticipantsDto, CreateGroupDto, RenameGroupDto } from './dto/group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    // Free-tier hosts wipe local disk on every redeploy — buffer in memory and
    // persist straight to the DB instead of writing to /uploads.
    storage: memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/\.(jpe?g|png|gif|webp|pdf|docx?|xlsx?|txt|csv|zip|mp4|mp3)$/i.test(file.originalname)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('File type not allowed. Supported: images, PDF, Word, Excel, text, CSV, ZIP, MP4, MP3.'), false);
      }
    },
  }))
  async uploadFile(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) throw new BadRequestException('No file uploaded');
    const attachment = await this.chatService.uploadAttachment(file.buffer, file.mimetype, file.originalname);
    return {
      // Absolute URL: consumed as-is by the mobile app's <Image>, which can't
      // resolve a relative path the way a browser resolves a same-origin one.
      url: `${req.protocol}://${req.get('host')}/api/v1/chat/attachments/${attachment.id}`,
      name: file.originalname,
      type: file.mimetype,
    };
  }

  // ── Direct messages: private, 1:1, inside one gym ────────────────────────
  //
  // Every handler here is scoped to the caller's own gym and own threads. There
  // is deliberately NO "all conversations in the gym" endpoint any more: that
  // was the shared desk inbox, and it let staff read the admin's messages.

  @Get('contacts')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getContacts(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.chatService.listContacts(user.gymId, user.id, user.role, search);
  }

  @Get('threads')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getThreads(@CurrentUser() user: any) {
    return this.chatService.listThreads(user.gymId, user.id);
  }

  @Get('unread-count')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  async getUnreadCount(@CurrentUser() user: any) {
    return { count: await this.chatService.unreadCount(user.gymId, user.id) };
  }

  @Get('threads/:peerId')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  openThread(@CurrentUser() user: any, @Param('peerId') peerId: string) {
    return this.chatService.getOrCreateDirect(user.gymId, user.id, peerId);
  }

  @Get('threads/:peerId/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getThreadMessages(
    @CurrentUser() user: any,
    @Param('peerId') peerId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.chatService.getDirectMessages(user.gymId, user.id, peerId, 50, skip);
  }

  @Patch('threads/:peerId/read')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  markThreadRead(@CurrentUser() user: any, @Param('peerId') peerId: string) {
    return this.chatService.markDirectRead(user.gymId, user.id, peerId);
  }

  // ── Groups: many-to-many rooms inside one gym ────────────────────────────
  //
  // Only a gym admin creates one, and only the owner renames it or changes who
  // is in it. Reading and posting are open to every active participant — the
  // gate is membership of the room, not the pair of roles, so two members who
  // may not DM each other can still both talk in a group.

  @Post('groups')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  createGroup(@CurrentUser() user: any, @Body() body: CreateGroupDto) {
    return this.chatService.createGroup(user.gymId, user.id, user.role, body.name, body.memberIds ?? []);
  }

  @Get('groups')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getGroups(@CurrentUser() user: any) {
    return this.chatService.listGroups(user.gymId, user.id);
  }

  @Get('groups/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getGroup(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.getGroup(user.gymId, user.id, id);
  }

  @Get('groups/:id/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getGroupMessages(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.chatService.getGroupMessages(user.gymId, user.id, id, 50, skip);
  }

  @Patch('groups/:id/read')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  markGroupRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.markGroupRead(user.gymId, user.id, id);
  }

  @Patch('groups/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  renameGroup(@CurrentUser() user: any, @Param('id') id: string, @Body() body: RenameGroupDto) {
    return this.chatService.renameGroup(user.gymId, user.id, id, body.name);
  }

  @Post('groups/:id/participants')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  addParticipants(@CurrentUser() user: any, @Param('id') id: string, @Body() body: AddParticipantsDto) {
    return this.chatService.addParticipants(user.gymId, user.id, id, body.memberIds);
  }

  @Delete('groups/:id/participants/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  removeParticipant(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.chatService.removeParticipant(user.gymId, user.id, id, userId);
  }

  @Post('groups/:id/leave')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF)
  leaveGroup(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.leaveGroup(user.gymId, user.id, id);
  }

  @Delete('groups/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  deleteGroup(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatService.deleteGroup(user.gymId, user.id, id);
  }

  // ── SUPPORT: gym admin ↔ super admin ─────────────────────────────────────

  @Get('support/conversation')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  getMySupport(@CurrentUser() user: any) {
    return this.chatService.getOrCreateSupportConversation(user.gymId, user.id);
  }

  @Get('support/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  getMySupportMessages(
    @CurrentUser() user: any,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.chatService.getSupportMessages(user.gymId, user.id, 50, skip);
  }

  @Patch('support/read')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  markMySupportRead(@CurrentUser() user: any) {
    return this.chatService.markSupportRead(user.gymId, user.id, false);
  }

  // SUPER_ADMIN endpoints
  @Get('support/conversations')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  getAllSupportConversations() {
    return this.chatService.getAllSupportConversations();
  }

  /**
   * Every gym the platform can message, searchable — including gyms that have
   * never written in, which `support/conversations` cannot return because it
   * only lists threads that already exist.
   */
  @Get('support/gyms')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  getSupportTargets(@Query('search') search?: string) {
    return this.chatService.listSupportTargets(search);
  }

  @Get('support/conversations/:gymAdminId/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  getSupportMessages(
    @Param('gymAdminId') gymAdminId: string,
    @Query('gymId') gymId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.chatService.getSupportMessages(gymId, gymAdminId, 50, skip);
  }

  @Patch('support/conversations/:gymAdminId/read')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  markSupportRead(
    @Param('gymAdminId') gymAdminId: string,
    @Query('gymId') gymId: string,
  ) {
    return this.chatService.markSupportRead(gymId, gymAdminId, true);
  }
}
