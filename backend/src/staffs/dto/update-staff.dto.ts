import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Staff profile fields an admin may edit. `userId`/`gymId` are never writable. */
export class UpdateStaffDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() employeeId?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() designation?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() department?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() joiningDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) salary?: number | null;
}
