import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';

export class UpdateMonitoringConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  webcamEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  micEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  screenMonitoring?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiDetectionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  eventLoggingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireConsent?: boolean;

  @ApiPropertyOptional({ description: 'Per-event-type risk points, e.g. { TAB_SWITCHED: 10 }' })
  @IsOptional()
  @IsObject()
  weights?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Risk thresholds, e.g. { low: 25, medium: 50, high: 75 }' })
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, number>;
}
