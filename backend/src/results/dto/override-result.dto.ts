import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { GRADE_LETTERS, GradeLetter } from '../grading.util';

export class OverrideResultDto {
  /**
   * Explicit letter grade. Sending `null` resets the grade back to the value
   * derived from the percentage, which is how an instructor "unlocks" a grade
   * that was previously set by hand.
   */
  @IsOptional()
  @IsString()
  @IsIn(GRADE_LETTERS as unknown as string[])
  grade?: GradeLetter | null;

  /** Overall result feedback. `null` clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string | null;

  /** Re-derive the letter grade from the current percentage without touching anything else. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  recomputeGrade?: boolean;
}
