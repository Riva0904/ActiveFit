import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StaffsService } from './staffs.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { gymScopeOf } from '../common/utils/gym-scope';
import { UpdateStaffDto } from './dto/update-staff.dto';

@ApiTags('Staffs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('staffs')
export class StaffsController {
  constructor(
    private readonly staffsService: StaffsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.usersService.createUser({ ...body, role: 'STAFF' }, user.role, user.gymId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : query.gymId;
    return this.staffsService.findAll(query, gymId);
  }

  @Get('me')
  @Roles(Role.STAFF)
  getMyProfile(@CurrentUser() user: any) {
    return this.staffsService.getMyProfile(user.id);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.staffsService.findOne(id, gymScopeOf(user));
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateStaffDto, @CurrentUser() user: any) {
    return this.staffsService.update(id, body, gymScopeOf(user));
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.staffsService.remove(id, gymScopeOf(user));
  }
}
