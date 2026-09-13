import { IsString, IsOptional, IsEmail, IsPhoneNumber, IsDateString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// Strips spaces (legacy '+91 98765 43210' formatting) and maps '' → null so a form
// that submits an empty phone field clears it instead of failing IsPhoneNumber.
const stripPhoneSpaces = Transform(({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.replace(/\s+/g, '');
  return trimmed === '' ? null : trimmed;
});

/**
 * Admin-side profile edit. Deliberately excludes `role`, `gymId`, `isActive`,
 * `isEmailVerified`, `password` and `refreshToken` — the global ValidationPipe runs
 * with `forbidNonWhitelisted`, so any of those in the body is rejected with a 400
 * instead of being written to the row. Activation has its own endpoints.
 */
export class UpdateUserDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() firstName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() lastName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @stripPhoneSpaces @IsPhoneNumber('IN') phone?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() avatar?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() city?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() state?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() pincode?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() country?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() emergencyContact?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() payoutUpiVpa?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() timezone?: string;
}
