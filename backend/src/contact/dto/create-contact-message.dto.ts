import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class CreateContactMessageDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'I would like to request an academic trial.' })
  @IsString()
  @Length(1, 4000)
  message: string;
}
