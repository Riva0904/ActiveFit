import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';

/**
 * Admin edit of an existing subscription. `memberId`, `gymId` and `planId` are not
 * writable here — re-pointing a subscription at another member/gym/plan is a new
 * subscription, not an edit.
 */
export class UpdateMembershipDto {
  @ApiProperty({ required: false, enum: MembershipStatus }) @IsOptional() @IsEnum(MembershipStatus) status?: MembershipStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() startDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() endDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) amount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() autoRenew?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() freezeStart?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() freezeEnd?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string | null;
}
