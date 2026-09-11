import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ProctoringAudioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  rms: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  zeroCrossings?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  samples?: number;
}