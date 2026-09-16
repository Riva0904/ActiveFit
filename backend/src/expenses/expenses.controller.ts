import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveGymScope } from '../common/utils/gym-scope';
import { EntitlementGuard } from '../entitlements/guards/entitlement.guard';
import { RequiresFeature } from '../entitlements/decorators/requires-feature.decorator';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, EntitlementGuard)
@Roles(Role.GYM_ADMIN)
@RequiresFeature('EXPENSES')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.create(dto, user.gymId);
  }

  // The reads also admit a SUPER_ADMIN drilling into a gym; every write above
  // and below stays on the controller-level @Roles(GYM_ADMIN).
  @Get()
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.expensesService.findAll(resolveGymScope(user, query.gymId), query);
  }

  @Get('monthly-totals')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getMonthlyTotals(@Query('year') year: string, @CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.expensesService.getMonthlyTotals(resolveGymScope(user, gymId), +(year ?? new Date().getFullYear()));
  }

  @Get('audit')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getAuditReport(
    @Query('month') month: string,
    @Query('year') year: string,
    @CurrentUser() user: any,
    @Query('gymId') gymId?: string,
  ) {
    const now = new Date();
    return this.expensesService.getAuditReport(
      resolveGymScope(user, gymId),
      +(month ?? now.getMonth() + 1),
      +(year ?? now.getFullYear()),
    );
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.update(id, dto, user.gymId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.remove(id, user.gymId);
  }
}
