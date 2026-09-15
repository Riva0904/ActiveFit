import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GymsService } from './gyms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateGymDto } from './dto/create-gym.dto';
import { SetGymPlanDto, UpdateGymAdminDto, UpdateGymProfileDto, UpdateGymStatusDto } from './dto/update-gym.dto';

@ApiTags('Gyms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gyms')
export class GymsController {
  constructor(private readonly gymsService: GymsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all gyms (Super Admin)' })
  findAll(@Query() query: any) {
    return this.gymsService.findAll(query);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create gym' })
  create(@Body() body: CreateGymDto) {
    return this.gymsService.create(body);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get gym by ID' })
  findOne(@Param('id') id: string) {
    return this.gymsService.findOne(id);
  }

  @Get(':id/stats')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get gym stats' })
  getStats(@Param('id') id: string) {
    return this.gymsService.getStats(id);
  }

  // Profile fields only. Subscription columns (saasPlan/saasStatus/saasExpiresAt)
  // are not accepted here from any role — they follow the GymSubscription row.
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Update gym profile' })
  update(@Param('id') id: string, @Body() body: UpdateGymProfileDto, @CurrentUser() user: any) {
    return this.gymsService.update(id, body, user);
  }

  @Patch(':id/admin')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update gym incl. super-admin-only fields (status, maxMembers, slug)' })
  updateAsAdmin(@Param('id') id: string, @Body() body: UpdateGymAdminDto, @CurrentUser() user: any) {
    return this.gymsService.update(id, body, user);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update gym status' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateGymStatusDto) {
    return this.gymsService.updateStatus(id, body.status);
  }

  @Patch(':id/subscription-plan')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set a gym SaaS tier (Super Admin only)' })
  setPlan(@Param('id') id: string, @Body() body: SetGymPlanDto, @CurrentUser() user: any) {
    return this.gymsService.setPlan(id, body, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete gym' })
  remove(@Param('id') id: string) {
    return this.gymsService.remove(id);
  }
}
