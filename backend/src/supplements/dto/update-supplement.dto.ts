import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Catalog fields an admin may edit. `gymId` is never writable — a product cannot be moved between tenants. */
export class UpdateSupplementDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() category?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() brand?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) discountPrice?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) stock?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() weight?: string | null;
  @ApiProperty({ required: false, type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isFeatured?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}
