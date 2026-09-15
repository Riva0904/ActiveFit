import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipGymScope } from '../common/decorators/skip-gym-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

@ApiTags('Platform Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@SkipGymScope()
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Read platform settings (Super Admin)' })
  get() {
    return this.service.get();
  }

  @Patch()
  @ApiOperation({ summary: 'Update platform settings (Super Admin)' })
  update(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: any) {
    return this.service.update(dto, user);
  }
}
