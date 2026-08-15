import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const INSTRUCTOR_ACTIONS = [
  'warning',
  'message',
  'pause',
  'resume',
  'extend',
  'force_submit',
  'disconnect',
  'note',
] as const;

export class InstructorActionDto {
  @ApiProperty({ enum: INSTRUCTOR_ACTIONS })
  @IsIn(INSTRUCTOR_ACTIONS)
  action: (typeof INSTRUCTOR_ACTIONS)[number];

  @ApiPropertyOptional({ description: 'Text for warning/message/note actions.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Minutes to extend when action is "extend".' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  minutes?: number;
}
