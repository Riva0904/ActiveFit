import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SupplementsService } from './supplements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { gymScopeOf } from '../common/utils/gym-scope';
import { UpdateSupplementDto } from './dto/update-supplement.dto';

@ApiTags('Supplements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supplements')
export class SupplementsController {
  constructor(private readonly supplementsService: SupplementsService) {}

  @Get()
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.supplementsService.findAll(query, user.gymId);
  }

  // Only gym admins see the gym's whole order book; everyone else sees their own.
  @Get('orders')
  @Roles(Role.MEMBER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getOrders(@Query() query: any, @CurrentUser() user: any) {
    const isAdmin = user.role === Role.GYM_ADMIN || user.role === Role.SUPER_ADMIN;
    if (isAdmin) {
      return this.supplementsService.getOrders(query, user.gymId ?? query.gymId, query.userId);
    }
    return this.supplementsService.getOrders(query, user.gymId, user.id, true);
  }

  @Get(':id')
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.supplementsService.findOne(id, gymScopeOf(user));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  create(@Body() body: any, @CurrentUser() user: any) {
    // SUPER_ADMIN has no gym of their own — they name the target gym in the body.
    const { gymId: bodyGymId, ...data } = body ?? {};
    const gymId = user.role === Role.SUPER_ADMIN ? bodyGymId : user.gymId;
    if (!gymId) throw new BadRequestException('gymId is required');
    return this.supplementsService.create({ ...data, gymId });
  }

  @Post('checkout')
  @Roles(Role.MEMBER)
  createCheckout(@Body() body: { items: any[]; useUpi?: boolean }, @CurrentUser() user: any) {
    return this.supplementsService.createCheckout(user.id, user.gymId, body.items, !!body.useUpi);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateSupplementDto, @CurrentUser() user: any) {
    return this.supplementsService.update(id, body, gymScopeOf(user));
  }

  @Patch(':id/stock')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  updateStock(@Param('id') id: string, @Body('quantity') quantity: number, @CurrentUser() user: any) {
    return this.supplementsService.updateStock(id, quantity, gymScopeOf(user));
  }

  @Patch('orders/:orderId/status')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  updateOrderStatus(@Param('orderId') orderId: string, @Body('status') status: any, @CurrentUser() user: any) {
    return this.supplementsService.updateOrderStatus(orderId, status, gymScopeOf(user));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.supplementsService.remove(id, gymScopeOf(user));
  }
}
