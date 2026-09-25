import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ViolationType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class LogViolationDto {
  @ApiProperty({ enum: ViolationType })
  @IsEnum(ViolationType)
  type: ViolationType;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  severity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  details?: unknown;
}
