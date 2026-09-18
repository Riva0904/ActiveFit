import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ProgressLogsService } from './progress-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveGymScope } from '../common/utils/gym-scope';
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

  /**
   * A member's logs, for their trainer or a gym admin. A trainer is allowed only
   * for their own assignees — enforced in the service, not here, because
   * `@Roles` cannot express "and this one is yours".
   */
  @Get('member/:memberId')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getMemberLogs(@Param('memberId') memberId: string, @CurrentUser() user: any) {
    return this.progressLogsService.findForMember(user, memberId, resolveGymScope(user));
  }

  @Post()
  @Roles(Role.MEMBER)
  create(@Body() body: CreateProgressLogDto, @CurrentUser() user: any) {
    return this.progressLogsService.create(user.id, user.gymId, body);
  }
}
