import { Controller, ForbiddenException, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { StorageService } from './storage.service';

const DENYLISTED_SEGMENTS = [/\.env$/i, /\.pem$/i, /\.key$/i, /\.sql$/i, /(^|\/)\.git\//, /^kyc\//i];
const STUDENT_ALLOWED_PREFIXES = ['avatars/', 'certificates/', 'questions/', 'uploads/'];

function isDenylisted(key: string): boolean {
  return DENYLISTED_SEGMENTS.some((pattern) => pattern.test(key));
}

@ApiBearerAuth()
@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('local/:key')
  async serveFile(
    @Param('key') key: string,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isStaff =
      user.roles.includes(RoleName.SUPER_ADMIN) ||
      user.roles.includes(RoleName.ADMIN) ||
      user.roles.includes(RoleName.INSTRUCTOR);

    if (isDenylisted(key)) {
      throw new ForbiddenException('This file is not accessible');
    }
    if (!isStaff && !STUDENT_ALLOWED_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix))) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const stream = this.storage.getFileStream(key);
    response.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment',
      'Cache-Control': 'private, no-store',
    });
    return stream;
  }
}