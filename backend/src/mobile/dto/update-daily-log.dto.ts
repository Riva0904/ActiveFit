import { IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * A partial write of one member-day. Every field is optional: the Home screen
 * ticks a checklist item, the water widget bumps `waterMl`, and the diet screen
 * sets `caloriesIn` — each without clobbering the others.
 *
 * `date` is the *device's* local day, not the server's, so a member crossing
 * midnight in IST does not write into yesterday's row.
 */
export class UpdateDailyLogDto {
  @ApiProperty({ required: false, example: '2026-09-18', description: "The device's local calendar day (YYYY-MM-DD)" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiProperty({ required: false, example: { workout: true, diet: false }, description: 'Checklist ticks; values are coerced to booleans' })
  @IsOptional()
  @IsObject()
  items?: Record<string, boolean>;

  @ApiProperty({ required: false, example: 2000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  waterMl?: number;

  @ApiProperty({ required: false, example: 1850 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20000)
  caloriesIn?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Sessions per week the member is aiming for. Seven is the ceiling by definition. */
export class SetWeeklyGoalDto {
  @ApiProperty({ example: 4, minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  weeklyGoal: number;
}
