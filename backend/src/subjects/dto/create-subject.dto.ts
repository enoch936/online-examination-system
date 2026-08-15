import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'MATH' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
