import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class AdminResetPasswordDto {
  @ApiProperty({ example: 'Str0ng!Passphrase' })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}