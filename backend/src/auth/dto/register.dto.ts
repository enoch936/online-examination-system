import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 'StrongPass@123' })
  @IsString()
  @MinLength(10)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/, {
    message: 'password must include uppercase, lowercase, and number characters',
  })
  password: string;
}
