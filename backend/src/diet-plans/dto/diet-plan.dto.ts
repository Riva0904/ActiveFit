import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

/** One meal slot. Shape matches what the AI generator emits and DietDetailScreen renders. */
export class MealDto {
  @IsString() @MaxLength(60) meal: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  items: string[];

  @IsOptional() @IsInt() @Min(0) @Max(10000) calories?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateDietPlanDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(60) goal?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(20000) totalCalories?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealDto)
  @ArrayMaxSize(12)
  meals: MealDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) restrictions?: string[];

  /** Premium = sold in the store. Plain plans are simply assigned to members. */
  @IsOptional() @IsBoolean() isPremium?: boolean;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
}

export class UpdateDietPlanDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) goal?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(20000) totalCalories?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealDto)
  @ArrayMaxSize(12)
  meals?: MealDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) restrictions?: string[];
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
}

/** Assign one plan to one or more members in a single call. */
export class AssignPlanDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  memberIds: string[];
}
