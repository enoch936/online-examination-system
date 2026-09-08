import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ description: 'Require instructor approval before a student resumes an interrupted session' })
  @IsOptional()
  @IsBoolean()
  resumeApprovalRequired?: boolean;

  @ApiPropertyOptional({
    enum: ExamConnectionLossPolicy,
    description: 'What happens when a student loses connection mid-exam',
  })
  @IsOptional()
  @IsEnum(ExamConnectionLossPolicy)
  connectionLossPolicy?: ExamConnectionLossPolicy;

  @ApiPropertyOptional({
    enum: ExamResumePolicy,
    description: 'How a student may resume an interrupted session',
  })
  @IsOptional()
  @IsEnum(ExamResumePolicy)
  resumePolicy?: ExamResumePolicy;

  @ApiPropertyOptional({
    enum: ExamRetakePolicy,
    description: 'How/if a student can retake the exam after submitting',
  })
  @IsOptional()
  @IsEnum(ExamRetakePolicy)
  retakePolicy?: ExamRetakePolicy;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  negativeMarkingRate?: number;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional({ description: 'Question bank to build this exam from' })
  @IsOptional()
  @IsUUID()
  questionBankId?: string;

  @ApiPropertyOptional({ description: 'Number of questions to randomly pick from the question bank' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  questionCount?: number;

  @ApiPropertyOptional({ type: [String], description: 'All courses this exam covers (primary courseId first)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courseIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Question banks used to build this exam' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  questionBankIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  questionIds?: string[];
}
