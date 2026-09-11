import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LoginRateLimitMiddleware } from '../common/middleware/login-rate-limit.middleware';
import { SuperAdminBootstrapService } from './superadmin.bootstrap';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') } as any,
      }),
    }),
    AuditLogsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SuperAdminBootstrapService],
  exports: [AuthService, SuperAdminBootstrapService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Login throttling is enforced by express-rate-limit (5/15min/IP) so that
    // standard + legacy rate-limit headers are present on every response,
    // including the 429. The route is @SkipThrottle'd to avoid a second,
    // separate throttler window. forRoutes honors the global "api/v1" prefix.
    consumer
      .apply(LoginRateLimitMiddleware)
      .forRoutes({ path: 'auth/login', method: RequestMethod.POST });
  }
}
