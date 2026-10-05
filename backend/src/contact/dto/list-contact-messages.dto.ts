import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { sanitizePlainText } from '../../common/utils/auth-hardening.util';

export const CONTACT_MESSAGE_STATUSES = ['NEW', 'READ', 'RESOLVED'] as const;

export type ContactMessageStatus = (typeof CONTACT_MESSAGE_STATUSES)[number];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ListContactMessagesDto {
  @ApiPropertyOptional({ description: 'Free-text search across name, email and message body' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? sanitizePlainText(value.trim(), 120) : value))
  q?: string;

  @ApiPropertyOptional({ enum: CONTACT_MESSAGE_STATUSES })
  @IsOptional()
  @IsIn(CONTACT_MESSAGE_STATUSES)
  status?: ContactMessageStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, maximum: MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;
}
