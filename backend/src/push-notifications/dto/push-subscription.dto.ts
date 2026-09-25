import { IsOptional, IsString } from 'class-validator';

export class CreatePushSubscriptionDto {
  @IsString()
  endpoint!: string;

  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class DeletePushSubscriptionDto {
  @IsString()
  endpoint!: string;
}