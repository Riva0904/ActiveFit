import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveGymScope } from '../common/utils/gym-scope';
import { GymSubscriptionsService } from './gym-subscriptions.service';
import { MarkSaasPaidDto, RequestSubscriptionDto } from './dto/gym-subscription.dto';

/**
 * Gym-admin subscription self-service. gymId always comes from the token, never
 * from the body, so one gym can never act on another's subscription.
 */
@ApiTags('Gym Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gym-subscriptions')
export class GymSubscriptionsController {
  constructor(private readonly service: GymSubscriptionsService) {}

  @Get('plans')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List purchasable plans' })
  plans() {
    return this.service.listPlansForGym();
  }

  @Get('me')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Current plan, limits, usage and any pending request' })
  me(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.service.getMine(resolveGymScope(user, gymId));
  }

  @Get('history')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Past subscription terms' })
  history(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.service.history(resolveGymScope(user, gymId));
  }

  @Get('requests')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'This gym’s subscription payment requests' })
  requests(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.service.myRequests(resolveGymScope(user, gymId));
  }

  // Writes a uniquely-coded row per call — throttled like the member payment route.
  @Post('request')
  @Roles(Role.GYM_ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Start a subscription purchase and get UPI payment details' })
  request(@Body() dto: RequestSubscriptionDto, @CurrentUser() user: any) {
    return this.service.request(user.gymId, user.id, dto);
  }

  @Post('requests/:id/mark-paid')
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Declare the UPI transfer as sent, pending super-admin confirmation' })
  markPaid(@Param('id') id: string, @Body() dto: MarkSaasPaidDto, @CurrentUser() user: any) {
    return this.service.markPaid(user.gymId, id, dto);
  }

  @Post('requests/:id/cancel')
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Cancel an unpaid or unconfirmed request' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.cancelRequest(user.gymId, id);
  }
}
