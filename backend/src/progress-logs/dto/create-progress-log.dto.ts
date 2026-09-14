import { IsNumber, IsOptional, IsString, IsDateString, IsArray, Max, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Body measurements a member logs about themselves. Field names match the Prisma
 * `ProgressLog` columns exactly — the mobile app used to post `bodyFatPercentage`,
 * which Prisma rejected with a 500; the global ValidationPipe now returns a 400
 * naming the unknown property instead.
 */
export class CreateProgressLogDto {
  @ApiProperty({ required: false, example: 72.5 }) @IsOptional() @IsNumber() @Min(20) @Max(400) weight?: number;
  @ApiProperty({ required: false, example: 175 }) @IsOptional() @IsNumber() @Min(50) @Max(280) height?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(1) @Max(80) bodyFat?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(200) muscleMass?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(300) chest?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(300) waist?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(300) hips?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(150) arms?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(200) thighs?: number;
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) photos?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() logDate?: string;
}
