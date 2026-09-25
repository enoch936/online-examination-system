import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';
import { normalizeEmail, sanitizePlainText } from '../../common/utils/auth-hardening.util';

export class RegisterDto {
  @ApiProperty({ example: 'student@example.edu' })
  @IsEmail()
  @Transform(({ value }) => normalizeEmail(value))
  email: string;

  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  firstName: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  @MinLength(2)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  lastName: string;

  @ApiProperty({ example: 'Str0ng!Passphrase' })
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile widget token (required when TURNSTILE_SECRET_KEY is set).' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}