import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExamEventType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class RecordEventDto {
  @ApiProperty({ enum: ExamEventType })
  @IsEnum(ExamEventType)
  type: ExamEventType;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Explicit risk points; defaults to the engine weight for the event type.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore?: number;
}
