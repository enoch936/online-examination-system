import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty, QuestionBankStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateQuestionBankDto {
  @ApiProperty()
  @IsUUID()
  courseId: string;

  @ApiProperty({ description: 'Category / subject the bank belongs to' })
  @IsUUID()
  categoryId: string;

  @ApiProperty({ example: 'Biology Final Examination Bank' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: QuestionBankStatus })
  @IsOptional()
  @IsEnum(QuestionBankStatus)
  status?: QuestionBankStatus;
}
