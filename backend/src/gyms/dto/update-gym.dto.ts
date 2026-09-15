import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { GymStatus, SaaSPlan, SaaSStatus } from '@prisma/client';

/**
 * Fields a GYM_ADMIN may change on their own gym (profile + payout details).
 *
 * `saasPlan`, `saasStatus` and `saasExpiresAt` are deliberately absent for EVERY
 * role — they are a denormalized cache of the authoritative GymSubscription row
 * and must have exactly one writer. Before this DTO existed the route took
 * `@Body() body: any`, which the global ValidationPipe skips entirely, so a gym
 * admin could grant themselves an ENTERPRISE plan for free.
 */
export class UpdateGymProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
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
  @IsOptional() @IsBoolean() renewalRemindersEnabled?: boolean;

  // Manual UPI payout details — where this gym collects member payments.
  @IsOptional() @IsString() payoutUpiVpa?: string;
  @IsOptional() @IsString() payoutAccountHolder?: string;
  @IsOptional() @IsString() payoutBankAccountNumber?: string;
  @IsOptional() @IsString() payoutBankIfsc?: string;
  @IsOptional() @IsString() payoutPhone?: string;
}

/** Everything above plus the fields only a SUPER_ADMIN may set. */
export class UpdateGymAdminDto extends UpdateGymProfileDto {
  @IsOptional() @IsEnum(GymStatus) status?: GymStatus;
  @IsOptional() @IsInt() @Min(0) maxMembers?: number;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, digits and hyphens' }) slug?: string;
  @IsOptional() @IsString() razorpayAccountId?: string;
}

export class UpdateGymStatusDto {
  @IsEnum(GymStatus)
  status: GymStatus;
}

/**
 * The ONLY way to change a gym's tier, and SUPER_ADMIN only. Kept separate from
 * the profile DTOs so a gym admin can never reach it. Phase 1 re-points this at
 * the GymSubscription record; until then it writes the denormalized columns.
 */
export class SetGymPlanDto {
  @IsEnum(SaaSPlan)
  plan: SaaSPlan;

  @IsOptional() @IsEnum(SaaSStatus) status?: SaaSStatus;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() reason?: string;
}

/**
 * Server-side allowlists, applied in GymsService on top of the DTO. Defence in
 * depth: if a future change reverts a handler to `@Body() body: any` the pipe
 * stops filtering, but the service still will.
 */
export const GYM_ADMIN_UPDATABLE_FIELDS = [
  'name', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'country', 'timezone',
  'logo', 'coverImage', 'description', 'website', 'gstin', 'amenities', 'openTime', 'closeTime',
  'workingDays', 'renewalRemindersEnabled',
  'payoutUpiVpa', 'payoutAccountHolder', 'payoutBankAccountNumber', 'payoutBankIfsc', 'payoutPhone',
] as const;

export const SUPER_ADMIN_UPDATABLE_FIELDS = [
  ...GYM_ADMIN_UPDATABLE_FIELDS,
  'status', 'maxMembers', 'slug', 'razorpayAccountId',
] as const;

/** Keep only the keys the caller's role is allowed to write. */
export function pickUpdatableGymFields(data: Record<string, unknown>, role: string): Record<string, unknown> {
  const allowed: readonly string[] = role === 'SUPER_ADMIN' ? SUPER_ADMIN_UPDATABLE_FIELDS : GYM_ADMIN_UPDATABLE_FIELDS;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (data?.[key] !== undefined) out[key] = data[key];
  }
  return out;
}
