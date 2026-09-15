import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, MinLength } from 'class-validator';
import { SaasBillingPeriod, SaasPaymentStatus } from '@prisma/client';

/**
 * Note what is NOT here: `amount`. The price is always read server-side from the
 * plan row, so a client cannot subscribe to ENTERPRISE for ₹1.
 */
export class RequestSubscriptionDto {
  @IsString()
  planId: string;

  @IsEnum(SaasBillingPeriod)
  billingPeriod: SaasBillingPeriod;
}

export class MarkSaasPaidDto {
  /** Bank/UPI transaction reference (UTR) the admin read off their payment app. */
  @IsOptional() @IsString() @Length(4, 60) upiReference?: string;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ConfirmSaasPaymentDto {
  @IsOptional() @IsString() bankReference?: string;
  @IsOptional() @IsString() notes?: string;
  /** Backdate the term start if the money actually landed earlier. */
  @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class RejectSaasPaymentDto {
  @IsString()
  @MinLength(3)
  reason: string;
}

export class GrantSubscriptionDto {
  @IsString() planId: string;
  @IsEnum(SaasBillingPeriod) billingPeriod: SaasBillingPeriod;
  @IsOptional() @IsInt() @Min(1) @Max(36) months?: number;
  @IsString() @MinLength(3) reason: string;
}

export class CancelSubscriptionDto {
  @IsString() @MinLength(3) reason: string;
  /** True ends the term now; false lets it run to endDate. */
  @IsOptional() @IsBoolean() immediate?: boolean;
}

export class ListSubscriptionPaymentsDto {
  @IsOptional() @IsEnum(SaasPaymentStatus) status?: SaasPaymentStatus;
  @IsOptional() @IsString() gymId?: string;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}
