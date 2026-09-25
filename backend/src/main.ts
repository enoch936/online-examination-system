import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { SuperAdminBootstrapService } from './auth/superadmin.bootstrap';
import { parseOrigins } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  const corsOrigins = parseOrigins(
    config.get<string>('CORS_ORIGIN') ?? config.get<string>('FRONTEND_URL'),
  );
  if (corsOrigins.length === 0 && nodeEnv !== 'production') {
    corsOrigins.push('http://localhost:3000');
  }

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  app.enableShutdownHooks();

  // Idempotent super admin bootstrap: creates the SUPER_ADMIN only when none
  // exists, using server-side env credentials (never hardcoded). Throws a clear
  // config error instead of starting if credentials are missing when required.
  await app.get(SuperAdminBootstrapService).ensure();

  console.log(`REST CORS: configured (${corsOrigins.length} origin(s): ${corsOrigins.join(', ')})`);

  if (config.get<boolean>('SWAGGER_ENABLED', false)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Online Examination System API')
      .setDescription('Enterprise-grade OES REST API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log('Swagger docs: enabled at /api/docs');
  }

  const port = config.get<number>('PORT', 4000);
  const host = config.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);

  console.log(`Server running on ${host}:${port} [${nodeEnv}]`);
}

void bootstrap();
