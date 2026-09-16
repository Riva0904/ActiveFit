import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { WorkoutPlansService } from './workout-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWorkoutPlanDto, UpdateWorkoutPlanDto } from './dto/workout-plan.dto';
import { AssignPlanDto } from '../diet-plans/dto/diet-plan.dto';

@ApiTags('Workout Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workout-plans')
export class WorkoutPlansController {
  constructor(private readonly workoutPlansService: WorkoutPlansService) {}

  @Get('my')
  @Roles(Role.MEMBER)
  getMyPlans(@CurrentUser() user: any) {
    return this.workoutPlansService.findByUser(user.id, user.gymId);
  }

  @Post('ai-generate')
  @Roles(Role.MEMBER, Role.TRAINER)
  generateAiPlan(
    @Body() body: { goal: string; level: string; daysPerWeek?: number; equipment?: string },
    @CurrentUser() user: any,
  ) {
    return this.workoutPlansService.generateAiPlan(user.id, user.gymId, body.goal, body.level, body.daysPerWeek, body.equipment);
  }

  // ── Premium Packages ──────────────────────────────────────────────────────

  @Get('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  listPackages(@CurrentUser() user: any) {
    return this.workoutPlansService.listPackages(user.gymId);
  }

  @Get(':id')
  @Roles(Role.MEMBER, Role.TRAINER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workoutPlansService.findById(id, user.gymId);
  }

  @Post('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  async createPackage(@Body() body: CreateWorkoutPlanDto, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await (this.workoutPlansService as any).prisma.trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.workoutPlansService.createPackage(body, user.gymId, trainerId);
  }

  @Patch('packages/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  updatePackage(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.workoutPlansService.updatePackage(id, body, user.gymId);
  }

  // ── Admin/trainer plan builder ────────────────────────────────────────────

  @Get('manage/all')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  listAll(@Query() query: any, @CurrentUser() user: any) {
    return this.workoutPlansService.listAll(user.gymId, query);
  }

  @Patch('manage/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  updatePlan(@Param('id') id: string, @Body() dto: UpdateWorkoutPlanDto, @CurrentUser() user: any) {
    return this.workoutPlansService.update(id, dto, user.gymId);
  }

  @Delete('manage/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workoutPlansService.softDelete(id, user.gymId);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  assign(@Param('id') id: string, @Body() dto: AssignPlanDto, @CurrentUser() user: any) {
    return this.workoutPlansService.assignToMembers(id, dto.memberIds, user.gymId);
  }

  @Get(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  assignments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workoutPlansService.listAssignments(id, user.gymId);
  }

  @Delete('assignments/:assignmentId')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  unassign(@Param('assignmentId') assignmentId: string, @CurrentUser() user: any) {
    return this.workoutPlansService.unassign(assignmentId, user.gymId);
  }

  @Post('packages/:id/buy')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  buyPackage(@Param('id') id: string, @Body() body: { useUpi?: boolean }, @CurrentUser() user: any) {
    return this.workoutPlansService.purchasePackage(id, user.id, user.gymId, !!body?.useUpi);
  }

  // Declared last so the ':id' wildcard cannot shadow the 'packages/:id' routes
  // above it. Previously it also carried no @Roles, letting any authenticated
  // user edit any workout plan in their gym.
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.workoutPlansService.update(id, body, user.gymId);
  }
}
