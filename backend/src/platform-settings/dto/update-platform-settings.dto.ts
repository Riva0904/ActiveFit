import { IsEmail, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  /** UPI virtual payment address, e.g. `activeboost@hdfcbank`. */
  @IsOptional()
  @IsString()
  @Matches(/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/, { message: 'upiVpa must look like name@bank' })
  upiVpa?: string;

  @IsOptional() @IsString() upiPayeeName?: string;
  @IsOptional() @IsInt() @Min(0) @Max(90) trialDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(30) graceDays?: number;
  @IsOptional() @IsEmail() supportEmail?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) gstPct?: number;
}
