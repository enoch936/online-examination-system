import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { normalizeEmail, sanitizePlainText } from '../../common/utils/auth-hardening.util';

export class CreateContactMessageDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => sanitizePlainText(value, 120))
  name: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => normalizeEmail(value))
  email: string;

  @ApiProperty({ example: 'I would like to request an academic trial.' })
  @IsString()
  @Length(1, 4000)
  @Transform(({ value }) => sanitizePlainText(value, 4000))
  message: string;
}