import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateContactStatusDto {
  @ApiProperty({ enum: ['NEW', 'READ', 'RESOLVED'] })
  @IsIn(['NEW', 'READ', 'RESOLVED'])
  status: 'NEW' | 'READ' | 'RESOLVED';
}