import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'student@example.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ example: 'Str0ng!Passphrase' })
  @IsStrongPassword()
  password: string;
}
