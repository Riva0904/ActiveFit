import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/**
 * One exercise on one day. Matches what ai-workout.generator emits and what
 * WorkoutDetailScreen filters by (`ex.day === DAYS[selectedDay]`), so the day
 * must be a full weekday name or the mobile screen silently shows a rest day.
 */
export class ExerciseDto {
  @IsIn(WEEKDAYS as unknown as string[]) day: string;
  @IsString() @MaxLength(80) name: string;
  @IsInt() @Min(1) @Max(20) sets: number;

  /** Either a count (12) or a prescription ("8-10", "45s hold"). */
  @IsOptional() reps?: string | number;

  @IsOptional() @IsInt() @Min(0) @Max(600) rest?: number;
  @IsOptional() @IsString() @MaxLength(40) muscle?: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class CreateWorkoutPlanDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(60) goal?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) difficulty?: string;
  @IsOptional() @IsInt() @Min(1) @Max(104) durationWeeks?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  @ArrayMaxSize(200)
  exercises: ExerciseDto[];

  @IsOptional() @IsBoolean() isPremium?: boolean;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
}

export class UpdateWorkoutPlanDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) goal?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) difficulty?: string;
  @IsOptional() @IsInt() @Min(1) @Max(104) durationWeeks?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseDto)
  @ArrayMaxSize(200)
  exercises?: ExerciseDto[];

  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
}
