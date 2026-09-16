import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PointsService } from './points.service';
import { BadgeService } from './badge.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class GamificationController {
  constructor(
    private pointsService: PointsService,
    private badgeService: BadgeService,
  ) {}

  // Points and badges are stored against Member.id, but the JWT only carries the
  // User id (`sub`) — there is no memberId claim. Reading with the user id made
  // every member's points and badges come back empty, so resolve the row first.

  @Get('my/points')
  @Roles(Role.MEMBER)
  async getMyPoints(@CurrentUser() user: any) {
    const memberId = await this.pointsService.resolveMemberId(user.id, user.gymId);
    if (!memberId) return { points: 0 }; // trainer/staff/admin: no member profile
    return { points: await this.pointsService.getMemberPoints(memberId, user.gymId) };
  }

  @Get('my/badges')
  @Roles(Role.MEMBER)
  async getMyBadges(@CurrentUser() user: any) {
    const memberId = await this.pointsService.resolveMemberId(user.id, user.gymId);
    if (!memberId) return [];
    return this.badgeService.getMemberBadges(memberId, user.gymId);
  }

  @Get('leaderboard')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.MEMBER, Role.TRAINER, Role.STAFF)
  getLeaderboard(@CurrentUser() user: any, @Query('limit') limit?: number) {
    return this.pointsService.getGymLeaderboard(user.gymId, limit ? +limit : 10);
  }
}
