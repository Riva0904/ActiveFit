import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { ProgressLogsService } from './progress-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateProgressLogDto } from './dto/create-progress-log.dto';
import { Role } from '@prisma/client';

@ApiTags('Progress Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress-logs')
export class ProgressLogsController {
  constructor(private readonly progressLogsService: ProgressLogsService) {}

  @Get('my')
  @Roles(Role.MEMBER)
  getMyLogs(@CurrentUser() user: any) {
    return this.progressLogsService.findByUser(user.id, user.gymId);
  }

  @Post()
  @Roles(Role.MEMBER)
  create(@Body() body: CreateProgressLogDto, @CurrentUser() user: any) {
    return this.progressLogsService.create(user.id, user.gymId, body);
  }
}
