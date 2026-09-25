import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from '../../common/utils/auth-hardening.util';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => normalizeEmail(value))
  email: string;

  @ApiProperty({ example: 'Str0ng!Passphrase' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile widget token (required when TURNSTILE_SECRET_KEY is set).' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}