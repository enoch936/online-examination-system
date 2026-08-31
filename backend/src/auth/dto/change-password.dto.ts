import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'The user\'s current password, required to authorize the change' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ description: 'The new password (must satisfy the strong-password policy)' })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}