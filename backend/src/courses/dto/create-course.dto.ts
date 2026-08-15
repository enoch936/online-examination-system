import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCourseDto {
  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiProperty({ example: 'MATH-101' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ example: 'Calculus I' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
