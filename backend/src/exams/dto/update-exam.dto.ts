import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ExamConnectionLossPolicy, ExamResumePolicy, ExamRetakePolicy } from '@prisma/client';

export class UpdateExamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalMarks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  passingMarks?: number;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional({ description: 'Require instructor approval before a student resumes an interrupted session' })
  @IsOptional()
  @IsBoolean()
  resumeApprovalRequired?: boolean;

  @ApiPropertyOptional({ enum: ExamConnectionLossPolicy })
  @IsOptional()
  @IsEnum(ExamConnectionLossPolicy)
  connectionLossPolicy?: ExamConnectionLossPolicy;

  @ApiPropertyOptional({ enum: ExamResumePolicy })
  @IsOptional()
  @IsEnum(ExamResumePolicy)
  resumePolicy?: ExamResumePolicy;

  @ApiPropertyOptional({ enum: ExamRetakePolicy })
  @IsOptional()
  @IsEnum(ExamRetakePolicy)
  retakePolicy?: ExamRetakePolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  negativeMarkingRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  questionIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courseIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  questionBankIds?: string[];
}
