import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * Time grant for one student, a chosen set, or every active session on an exam.
 *
 * Omitting both `studentIds` and `classId` covers the whole exam, which is why
 * neither is required: the "extend everyone" case is a legitimate one.
 */
export class BulkExtendTimeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  minutes: number;

  /** Restrict to these students. Omit to cover every active session. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  /** Restrict to the students enrolled in this class. Intersected with studentIds. */
  @IsOptional()
  @IsUUID()
  classId?: string;

  /** Stored on every audit row so a later review can see why time was granted. */
  @IsOptional()
  @IsString()
  reason?: string;
}