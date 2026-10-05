import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * Selection for a bulk grading run.
 *
 * The target set is expressed the way staff actually think about it — an exam,
 * optionally narrowed to a class and/or specific students — and the backend
 * resolves that against the real Class/Enrollment/Submission tables.
 */
export class BulkGradeDto {
  @IsUUID()
  examId: string;

  /** Narrow to the students enrolled in this class. */
  @IsOptional()
  @IsUUID()
  classId?: string;

  /** Narrow further to these students (intersected with classId when both given). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  /** Only attempts that still owe grading work. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyUngraded?: boolean;

  /** Explicitly re-grade attempts that are already GRADED. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  regrade?: boolean;
}

/** Direct selection by result id, used when the UI submits chosen rows. */
export class BulkGradeByIdsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  resultIds: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  regrade?: boolean;
}