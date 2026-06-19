import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SaveAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedOptionIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  answerText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  answerJson?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBookmarked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMarkedForReview?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  remainingSeconds?: number;
}
