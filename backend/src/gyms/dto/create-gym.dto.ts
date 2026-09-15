import { IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { GymStatus, SaaSPlan, SaaSStatus } from '@prisma/client';

/**
 * SUPER_ADMIN-only gym creation. `saasPlan` is accepted here (a new gym has no
 * subscription row yet, so there is nothing to contradict) but NOT on update —
 * see UpdateGymProfileDto.
 */
export class CreateGymDto {
  @IsString() name: string;
  @IsString() @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, digits and hyphens' }) slug: string;
  @IsEmail() email: string;
  @IsString() phone: string;
  @IsString() address: string;
  @IsString() city: string;
  @IsString() state: string;
  @IsString() pincode: string;

  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
  @IsOptional() @IsString() openTime?: string;
  @IsOptional() @IsString() closeTime?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) workingDays?: string[];
  @IsOptional() @IsInt() @Min(0) maxMembers?: number;
  @IsOptional() @IsEnum(GymStatus) status?: GymStatus;
  @IsOptional() @IsEnum(SaaSPlan) saasPlan?: SaaSPlan;
  @IsOptional() @IsEnum(SaaSStatus) saasStatus?: SaaSStatus;
  @IsOptional() @IsDateString() saasExpiresAt?: string;
}
