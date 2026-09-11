import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { normalizeEmail, sanitizePlainText } from '../../common/utils/auth-hardening.util';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => normalizeEmail(value))
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizePlainText(value, 32))
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => sanitizePlainText(value, 2048))
  avatarUrl?: string;
}