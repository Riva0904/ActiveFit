import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayoutItemDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'This person’s amount for the run — set per row, not shared' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

export class BatchPayoutDto {
  @ApiProperty({ example: 'September 2026' })
  @IsString()
  @MaxLength(60)
  periodLabel: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // A cap keeps one request from writing an unbounded transaction; no gym pays
  // 100 people in a single run on this product.
  @ApiProperty({ type: [PayoutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PayoutItemDto)
  items: PayoutItemDto[];
}

export class MarkManyPaidDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  ids: string[];
}
