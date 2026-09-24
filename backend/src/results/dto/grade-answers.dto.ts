import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GradeAnswerItemDto {
  @IsUUID()
  answerId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

export class GradeAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeAnswerItemDto)
  answers: GradeAnswerItemDto[];
}