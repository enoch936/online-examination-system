import { ApiPropertyOptional } from '@nestjs/swagger';
import { FullscreenPolicy, MicMode, MonitoringStrictness, WebcamMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({ enum: WebcamMode, description: 'Webcam enforcement mode. Shadows webcamEnabled when set.' })
  @IsOptional()
  @IsEnum(WebcamMode)
  webcamMode?: WebcamMode;

  @ApiPropertyOptional({ enum: MicMode, description: 'Microphone enforcement mode. Shadows micEnabled when set.' })
  @IsOptional()
  @IsEnum(MicMode)
  micMode?: MicMode;

  @ApiPropertyOptional({ enum: FullscreenPolicy })
  @IsOptional()
  @IsEnum(FullscreenPolicy)
  fullscreenPolicy?: FullscreenPolicy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackTabSwitches?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackWindowBlur?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disableCopy?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disablePaste?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  detectClipboard?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  detectShortcuts?: boolean;

  @ApiPropertyOptional({ description: 'Number of violations before a session is auto-flagged for review', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  violationThreshold?: number;

  @ApiPropertyOptional({ enum: MonitoringStrictness })
  @IsOptional()
  @IsEnum(MonitoringStrictness)
  strictness?: MonitoringStrictness;

  @ApiPropertyOptional({ description: 'Per-event-type risk points, e.g. { TAB_SWITCHED: 10 }' })
  @IsOptional()
  @IsObject()
  weights?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Risk thresholds, e.g. { low: 25, medium: 50, high: 75 }' })
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, number>;
}
