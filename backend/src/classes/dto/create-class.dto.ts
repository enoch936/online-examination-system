import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateClassDto {
  @ApiProperty()
  @IsUUID()
  courseId: string;

  @ApiProperty()
  @IsUUID()
  instructorId: string;

  @ApiProperty({ example: 'CS101 - Section A' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'CS101-A' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}