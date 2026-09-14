import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsISO8601, IsLatitude, IsLongitude, IsOptional, Max, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RoutePointDto {
  @ApiProperty({ example: 12.9716 }) @IsLatitude() lat: number;
  @ApiProperty({ example: 77.5946 }) @IsLongitude() lng: number;
  @ApiProperty({ description: 'Unix epoch seconds' }) @IsInt() @Min(0) ts: number;
}

/**
 * A finished run uploaded by the mobile tracker. Distance/duration are client-measured;
 * pace is recomputed server-side. Route is capped at 20 000 points (~11 h at 2 s fixes).
 */
export class CreateRunDto {
  @ApiProperty() @IsISO8601() startedAt: string;
  @ApiProperty() @IsISO8601() endedAt: string;
  @ApiProperty({ example: 8566 }) @IsInt() @Min(0) @Max(200000) distanceMeters: number;
  @ApiProperty({ example: 2653 }) @IsInt() @Min(1) @Max(86400) durationSec: number;
  @ApiProperty({ required: false, example: 620 }) @IsOptional() @IsInt() @Min(0) @Max(20000) calories?: number;
  @ApiProperty({ type: [RoutePointDto] })
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(20000) @ValidateNested({ each: true }) @Type(() => RoutePointDto)
  route: RoutePointDto[];
}
