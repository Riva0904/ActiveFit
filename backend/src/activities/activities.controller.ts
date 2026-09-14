import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivitiesService } from './activities.service';
import { CreateRunDto } from './dto/create-run.dto';

@ApiTags('Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MEMBER)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post('runs')
  @ApiOperation({ summary: 'Save a finished GPS run (mobile tracker)' })
  createRun(@Body() dto: CreateRunDto, @CurrentUser() user: any) {
    return this.activities.createRun(user.id, user.gymId, dto);
  }

  @Get('runs/my')
  @ApiOperation({ summary: 'My runs, newest first (no route payload)' })
  listMy(@CurrentUser() user: any, @Query('limit') limit?: string, @Query('skip') skip?: string) {
    return this.activities.listMy(user.id, user.gymId, { limit: Number(limit), skip: Number(skip) });
  }

  @Get('runs/latest')
  @ApiOperation({ summary: 'My most recent run with route (Home card)' })
  latest(@CurrentUser() user: any) {
    return this.activities.latest(user.id, user.gymId);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'One of my runs with its route' })
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.activities.getOne(user.id, user.gymId, id);
  }
}
