import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BatchPayoutDto, MarkManyPaidDto } from './dto/batch-payout.dto';
import { Role } from '@prisma/client';
import { SalaryPayoutsService } from './salary-payouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveGymScope } from '../common/utils/gym-scope';
import { EntitlementGuard } from '../entitlements/guards/entitlement.guard';
import { RequiresFeature } from '../entitlements/decorators/requires-feature.decorator';

@ApiTags('Salary Payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@Controller('salary-payouts')
export class SalaryPayoutsController {
  constructor(private readonly service: SalaryPayoutsService) {}

  @Post()
  @Roles(Role.GYM_ADMIN)
  @RequiresFeature('PAYROLL')
  create(@Body() body: { userId: string; amount: number; periodLabel: string; notes?: string }, @CurrentUser() user: any) {
    return this.service.create(user.gymId, body);
  }

  @Post('batch')
  @Roles(Role.GYM_ADMIN)
  @RequiresFeature('PAYROLL')
  @ApiOperation({ summary: 'One payroll run: several people, each with their own amount' })
  createBatch(
    @Body() body: BatchPayoutDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createBatch(user.gymId, body);
  }

  @Patch('mark-paid')
  @Roles(Role.GYM_ADMIN)
  @RequiresFeature('PAYROLL')
  @ApiOperation({ summary: 'Mark a whole run paid' })
  markManyPaid(@Body() body: MarkManyPaidDto, @CurrentUser() user: any) {
    return this.service.markManyPaid(user.gymId, body.ids);
  }

  @Get()
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @RequiresFeature('PAYROLL')
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.service.findAllForGym(resolveGymScope(user, query.gymId), query);
  }

  @Get('my')
  @Roles(Role.TRAINER, Role.STAFF)
  findMine(@CurrentUser() user: any) {
    return this.service.findMine(user.id);
  }

  @Patch(':id/mark-paid')
  @Roles(Role.GYM_ADMIN)
  @RequiresFeature('PAYROLL')
  markPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markPaid(id, user.gymId);
  }
}
