import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TrainersService } from './trainers.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { gymScopeOf, resolveGymScopeOptional } from '../common/utils/gym-scope';
import { UpdateTrainerDto } from './dto/update-trainer.dto';

@ApiTags('Trainers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trainers')
export class TrainersController {
  constructor(
    private readonly trainersService: TrainersService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.usersService.createUser({ ...body, role: 'TRAINER' }, user.role, user.gymId, user.id);
  }

  // Only a SUPER_ADMIN may target another gym. The old ternary tested for
  // GYM_ADMIN, so members, trainers and staff fell into the `query.gymId` branch
  // and — with no param — got every gym's trainer roster.
  @Get()
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = resolveGymScopeOptional(user, query.gymId);
    return this.trainersService.findAll(query, gymId);
  }

  @Get('performance')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getPerformance(@CurrentUser() user: any) {
    return this.trainersService.getPerformance(user.gymId);
  }

  @Get('my-dashboard')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER)
  getMyDashboard(@CurrentUser() user: any) {
    return this.trainersService.getMyDashboardStats(user.id, user.gymId);
  }

  /**
   * The trainer a member is currently with. Declared before `:id` so the literal
   * segment is not swallowed by the parameterised route.
   */
  @Get('of-member/:memberId')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  findTrainerOfMember(@Param('memberId') memberId: string, @CurrentUser() user: any) {
    return this.trainersService.findAssignedTrainer(memberId, user.gymId);
  }

  @Get(':id')
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trainersService.findOne(id, gymScopeOf(user));
  }

  @Get(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  listAssignments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trainersService.listAssignments(id, user.gymId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  update(@Param('id') id: string, @Body() body: UpdateTrainerDto, @CurrentUser() user: any) {
    // A trainer may edit only their own profile (settings page); admins edit any in their gym.
    const selfUserId = user.role === Role.TRAINER ? user.id : undefined;
    return this.trainersService.update(id, body, gymScopeOf(user), selfUserId);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  assignMember(@Param('id') id: string, @Body('memberId') memberId: string, @CurrentUser() user: any) {
    return this.trainersService.assignMember(id, memberId, user.gymId);
  }

  @Delete(':id/assign/:memberId')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  unassignMember(@Param('id') id: string, @Param('memberId') memberId: string, @CurrentUser() user: any) {
    return this.trainersService.unassignMember(id, memberId, user.gymId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trainersService.remove(id, gymScopeOf(user));
  }
}
