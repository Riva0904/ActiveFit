import {
  Controller, Get, Patch, Post, Param, Query, Req, UseGuards,
  ParseIntPipe, DefaultValuePipe, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveGymScope } from '../common/utils/gym-scope';

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

  // ── Non-admin: own GYM conversation ──────────────────────────────────────

  @Get('my-conversation')
  @Roles(Role.MEMBER, Role.TRAINER)
  getMyConversation(@CurrentUser() user: any) {
    return this.chatService.getOrCreateConversation(user.gymId, user.id);
  }

  @Get('my-messages')
  @Roles(Role.MEMBER, Role.TRAINER)
  getMyMessages(
    @CurrentUser() user: any,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
  ) {
    return this.chatService.getMessages(user.gymId, user.id, 50, skip);
  }

  @Patch('my-conversation/read')
  @Roles(Role.MEMBER, Role.TRAINER)
  markMyRead(@CurrentUser() user: any) {
    return this.chatService.markRead(user.gymId, user.id, false);
  }

  // ── Gym admin: all GYM conversations ─────────────────────────────────────

  @Get('conversations')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF, Role.SUPER_ADMIN)
  getAllConversations(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.chatService.getAllConversations(resolveGymScope(user, gymId));
  }

  @Get('conversations/:userId/messages')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF, Role.SUPER_ADMIN)
  getConversationMessages(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('gymId') gymId?: string,
  ) {
    return this.chatService.getMessages(resolveGymScope(user, gymId), userId, 50, skip);
  }

  @Patch('conversations/:userId/read')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  markConversationRead(@CurrentUser() user: any, @Param('userId') userId: string) {
    return this.chatService.markRead(user.gymId, userId, true);
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
