import { IsString, IsOptional, IsArray, IsInt, IsNumber, IsBoolean, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Trainer profile fields an admin (or the trainer, via settings) may edit. `userId`/`gymId` are never writable. */
export class UpdateTrainerDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() employeeId?: string | null;
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) specializations?: string[];
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) certifications?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) experience?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() bio?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) hourlyRate?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isAvailable?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() joiningDate?: string;
}
