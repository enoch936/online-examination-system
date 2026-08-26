import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      // Full detail stays in server logs only — never in the response body.
      // eslint-disable-next-line no-console
      console.error(
        `[${new Date().toISOString()}] ${request?.method} ${request?.originalUrl ?? request?.url} -> ${status}`,
        exception,
      );
    }

    let body: unknown;
    if (exception instanceof HttpException) {
      body = exception.getResponse();
    } else {
      body = 'Internal server error';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      error: typeof body === 'string' ? { message: body } : body,
    });
  }
}
