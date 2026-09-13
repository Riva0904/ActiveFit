import { Controller, Get, Param, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { Public } from '../common/decorators/public.decorator';

// Deliberately public (opted out of the global JwtAuthGuard): the id is an
// unguessable uuid, same trust model as the public Cloudinary URLs this replaced,
// and both the web <img>/<a> tags and the mobile app's <Image> need to fetch it
// without attaching cookie/Bearer auth.
@ApiTags('Chat')
@Public()
@Controller('chat/attachments')
export class ChatAttachmentsController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':id')
  async getAttachment(@Param('id') id: string, @Res() res: Response) {
    const attachment = await this.chatService.getAttachment(id);
    if (!attachment) throw new NotFoundException('Attachment not found');
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${attachment.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.send(Buffer.from(attachment.data));
  }
}
