import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipGymScope } from '../common/decorators/skip-gym-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GymSubscriptionsService } from './gym-subscriptions.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import {
  CancelSubscriptionDto,
  ConfirmSaasPaymentDto,
  GrantSubscriptionDto,
  ListSubscriptionPaymentsDto,
  RejectSaasPaymentDto,
} from './dto/gym-subscription.dto';

@ApiTags('Gym Subscriptions (Super Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@SkipGymScope()
@Controller('admin/gym-subscriptions')
export class AdminGymSubscriptionsController {
  constructor(
    private readonly service: GymSubscriptionsService,
    private readonly expiry: SubscriptionExpiryService,
  ) {}

  @Get('pending')
  @ApiOperation({ summary: 'UPI payments awaiting confirmation, oldest first' })
  pending() {
    return this.service.pending();
  }

  @Get('requests')
  @ApiOperation({ summary: 'Full subscription payment ledger' })
  requests(@Query() query: ListSubscriptionPaymentsDto) {
    return this.service.listPayments(query);
  }

  @Get()
  @ApiOperation({ summary: 'All gym subscriptions' })
  list(@Query() query: any) {
    return this.service.listSubscriptions(query);
  }

  @Post('requests/:id/confirm')
  @ApiOperation({ summary: 'Confirm receipt of a UPI transfer and activate the plan' })
  confirm(@Param('id') id: string, @Body() dto: ConfirmSaasPaymentDto, @CurrentUser() user: any) {
    return this.service.confirm(id, dto, user);
  }

  @Post('requests/:id/reject')
  @ApiOperation({ summary: 'Reject a claimed payment with a reason' })
  reject(@Param('id') id: string, @Body() dto: RejectSaasPaymentDto, @CurrentUser() user: any) {
    return this.service.reject(id, dto, user);
  }

  @Post('gyms/:gymId/grant')
  @ApiOperation({ summary: 'Grant a plan without payment (comp, offline deal, make-good)' })
  grant(@Param('gymId') gymId: string, @Body() dto: GrantSubscriptionDto, @CurrentUser() user: any) {
    return this.service.grant(gymId, dto, user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription now or at period end' })
  cancel(@Param('id') id: string, @Body() dto: CancelSubscriptionDto, @CurrentUser() user: any) {
    return this.service.cancel(id, dto, user);
  }

  @Post('run-expiry')
  @ApiOperation({ summary: 'Run the expiry sweep immediately' })
  runExpiry() {
    return this.expiry.sweep();
  }
}
