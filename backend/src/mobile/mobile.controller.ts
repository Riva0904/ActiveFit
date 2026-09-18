import { Controller, Get, Post, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MobileService } from './mobile.service';
import { SetWeeklyGoalDto, UpdateDailyLogDto } from './dto/update-daily-log.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Mobile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mobile')
export class MobileController {
  constructor(private mobileService: MobileService) {}

  /**
   * Single endpoint returns everything the mobile home screen needs:
   * profile + active membership + today's workout + today's diet + attendance status.
   * Replaces 5 separate API calls on app startup.
   */
  @Get('home')
  getHomeData(@CurrentUser() user: any) {
    return this.mobileService.getHomeData(user.id, user.gymId);
  }

  /** Register a FCM/APNs push token for this device */
  @Post('push-token')
  registerPushToken(
    @CurrentUser() user: any,
    @Body() body: { token: string; platform: 'ios' | 'android'; deviceId?: string },
  ) {
    return this.mobileService.registerPushToken(user.id, body.token, body.platform, body.deviceId);
  }

  /** Deactivate a push token on logout */
  @Post('push-token/deactivate')
  deactivatePushToken(@Body() body: { token: string }) {
    return this.mobileService.deactivatePushToken(body.token);
  }

  /** Aggregated home screen data for trainers */
  @Get('trainer-home')
  @Roles(Role.TRAINER)
  getTrainerHomeData(@CurrentUser() user: any) {
    return this.mobileService.getTrainerHomeData(user.id, user.gymId);
  }

  /** Offline-safe check-in: accepts a pre-signed member QR token */
  @Post('checkin')
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF)
  mobileCheckIn(@CurrentUser() user: any, @Body() body: { gymId?: string }) {
    return this.mobileService.selfCheckIn(user.id, body.gymId ?? user.gymId);
  }

  /** Today's checklist ticks, water and calories. `date` is the device's local day. */
  @Get('daily-log')
  @Roles(Role.MEMBER)
  getDailyLog(@CurrentUser() user: any, @Query('date') date?: string) {
    return this.mobileService.getDailyLog(user.id, user.gymId, date);
  }

  /** Partial update — only the fields present in the body are written. */
  @Put('daily-log')
  @Roles(Role.MEMBER)
  upsertDailyLog(@CurrentUser() user: any, @Body() body: UpdateDailyLogDto) {
    return this.mobileService.upsertDailyLog(user.id, user.gymId, body);
  }

  /** How many sessions a week the member is aiming for (1–7). */
  @Put('weekly-goal')
  @Roles(Role.MEMBER)
  setWeeklyGoal(@CurrentUser() user: any, @Body() body: SetWeeklyGoalDto) {
    return this.mobileService.setWeeklyGoal(user.id, user.gymId, body.weeklyGoal);
  }
}
