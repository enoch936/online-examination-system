  import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { appConfig, validateConfig } from './config/app.config';
import { CertificatesModule } from './certificates/certificates.module';
import { CoursesModule } from './courses/courses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExamsModule } from './exams/exams.module';
import { ExamSessionsModule } from './exam-sessions/exam-sessions.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './questions/questions.module';
import { ReportsModule } from './reports/reports.module';
import { ResultsModule } from './results/results.module';
import { RolesModule } from './roles/roles.module';
import { StorageModule } from './storage/storage.module';
import { SubjectsModule } from './subjects/subjects.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { UsersModule } from './users/users.module';
import { RealtimeModule } from './websocket/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateConfig,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('RATE_LIMIT_TTL', 60),
            limit: config.get<number>('RATE_LIMIT_LIMIT', 120),
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SubjectsModule,
    CoursesModule,
    DashboardModule,
    ExamsModule,
    QuestionsModule,
    ExamSessionsModule,
    SubmissionsModule,
    ResultsModule,
    CertificatesModule,
    NotificationsModule,
    ReportsModule,
    AuditLogsModule,
    RealtimeModule,
    StorageModule,
    MonitoringModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
