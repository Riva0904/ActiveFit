import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipGymScope } from '../common/decorators/skip-gym-scope.decorator';
import { gymScopeOf } from '../common/utils/gym-scope';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Create user (staff/admin create member or trainer, admin also staff, super admin creates gym admin)' })
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.usersService.createUser(body, user.role, user.gymId);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get all users' })
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : query.gymId;
    return this.usersService.findAll(query, gymId);
  }

  @Get('me')
  @SkipGymScope()
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('me/export')
  @SkipGymScope()
  @ApiOperation({ summary: 'Export all of the requesting user\'s own data (data portability)' })
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  exportMyData(@CurrentUser('id') id: string) {
    return this.usersService.exportOwnData(id);
  }

  @Get('stats')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get member stats' })
  getStats(@CurrentUser() user: any, @Query('gymId') gymId: string) {
    return this.usersService.getMemberStats(user.role === Role.GYM_ADMIN ? user.gymId : gymId);
  }

  @Get('stats/growth')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get member growth over last 6 months' })
  getGrowth(@CurrentUser() user: any, @Query('gymId') gymId: string) {
    return this.usersService.getMemberGrowth(user.role === Role.GYM_ADMIN ? user.gymId : gymId);
  }

  @Get('at-risk')
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get members with active membership who have not checked in recently' })
  getAtRisk(
    @CurrentUser() user: any,
    @Query('days', new DefaultValuePipe(14), ParseIntPipe) days: number,
  ) {
    return this.usersService.getAtRiskMembers(user.gymId, days);
  }

  // Every /:id handler below is tenant-scoped: a GYM_ADMIN can only reach users of
  // their own gym (other tenants' ids 404), SUPER_ADMIN is unscoped.

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.findOne(id, gymScopeOf(user));
  }

  @Patch('me')
  @SkipGymScope()
  @ApiOperation({ summary: 'Update own profile (role, gymId, isActive etc. are ignored)' })
  updateMe(@CurrentUser('id') id: string, @Body() body: any) {
    return this.usersService.updateOwnProfile(id, body);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Update user (profile fields only — role/gymId/isActive are rejected)' })
  update(@Param('id') id: string, @Body() body: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.update(id, body, gymScopeOf(user));
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Deactivate user' })
  deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.deactivate(id, gymScopeOf(user));
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Activate user' })
  activate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.activate(id, gymScopeOf(user));
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Permanently delete user' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, gymScopeOf(user));
  }

  @Post(':id/send-winback')
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Send a win-back email and notification to a member' })
  sendWinback(@Param('id') memberId: string, @CurrentUser() user: any) {
    return this.usersService.sendWinbackMessage(memberId, user.gymId);
  }
}
