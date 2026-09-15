import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DietPlansService } from './diet-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssignPlanDto, CreateDietPlanDto, UpdateDietPlanDto } from './dto/diet-plan.dto';

@ApiTags('Diet Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('diet-plans')
export class DietPlansController {
  constructor(private readonly dietPlansService: DietPlansService) {}

  @Get('my')
  getMyPlans(@CurrentUser() user: any) {
    return this.dietPlansService.findByUser(user.id, user.gymId);
  }

  @Post('ai-generate')
  generateAi(
    @Body() body: { goal: string; calories?: number; dietaryPreference?: string; mealsPerDay?: number; allergies?: string },
    @CurrentUser() user: any,
  ) {
    return this.dietPlansService.generateAiDiet(
      user.id, user.gymId, body.goal, body.calories,
      body.dietaryPreference, body.mealsPerDay, body.allergies,
    );
  }

  // ── Premium Packages ──────────────────────────────────────────────────────

  @Get('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  listPackages(@CurrentUser() user: any) {
    return this.dietPlansService.listPackages(user.gymId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dietPlansService.findById(id, user.gymId);
  }

  @Post('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  async createPackage(@Body() body: CreateDietPlanDto, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await (this.dietPlansService as any).prisma.trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.dietPlansService.createPackage(body, user.gymId, trainerId);
  }

  @Patch('packages/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  updatePackage(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.dietPlansService.updatePackage(id, body, user.gymId);
  }

  // ── Admin/trainer plan builder ────────────────────────────────────────────

  @Get('manage/all')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  @ApiOperation({ summary: 'Every diet plan in the gym (premium and plain)' })
  listAll(@Query() query: any, @CurrentUser() user: any) {
    return this.dietPlansService.listAll(user.gymId, query);
  }

  @Patch('manage/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  @ApiOperation({ summary: 'Edit a diet plan, including its meals' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdateDietPlanDto, @CurrentUser() user: any) {
    return this.dietPlansService.updatePlan(id, dto, user.gymId);
  }

  @Delete('manage/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  @ApiOperation({ summary: 'Soft-delete a diet plan and deactivate its assignments' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dietPlansService.softDelete(id, user.gymId);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  @ApiOperation({ summary: 'Assign a diet plan to one or more members' })
  assign(@Param('id') id: string, @Body() dto: AssignPlanDto, @CurrentUser() user: any) {
    return this.dietPlansService.assignToMembers(id, dto.memberIds, user.gymId);
  }

  @Get(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  @ApiOperation({ summary: 'Members currently on this diet plan' })
  assignments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dietPlansService.listAssignments(id, user.gymId);
  }

  @Delete('assignments/:assignmentId')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  @ApiOperation({ summary: 'Remove a member from a diet plan' })
  unassign(@Param('assignmentId') assignmentId: string, @CurrentUser() user: any) {
    return this.dietPlansService.unassign(assignmentId, user.gymId);
  }

  @Post('packages/:id/buy')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  buyPackage(@Param('id') id: string, @Body() body: { useUpi?: boolean }, @CurrentUser() user: any) {
    return this.dietPlansService.purchasePackage(id, user.id, user.gymId, !!body?.useUpi);
  }
}
