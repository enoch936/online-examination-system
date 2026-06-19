import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateExamDto {
  @ApiProperty()
  @IsUUID()
  courseId: string;

  @ApiProperty({ example: 'Midterm Examination' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiProperty({ example: 90 })
  @IsNumber()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  totalMarks: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  passingMarks: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  attemptsAllowed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  randomizeQuestions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  randomizeOptions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fullscreenRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showResultImmediately?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  negativeMarkingRate?: number;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  questionIds?: string[];
}
