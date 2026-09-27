import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CertificatesService } from './certificates.service';

@ApiBearerAuth()
@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @ApiQuery({ name: 'examId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('examId') examId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.certificates.list(user, {
      examId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // Declared before the `:id/pdf` route so the literal `verify` segment can
  // never be swallowed by the `:id` parameter.
  @Public()
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificates.verify(code);
  }

  @Post('exams/:examId/generate')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  generate(@Param('examId', ParseUUIDPipe) examId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.generateForExam(examId, user);
  }

  @Post(':resultId/issue')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  issue(@Param('resultId', ParseUUIDPipe) resultId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.issue(resultId, user);
  }

  @Get(':id/pdf')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR, RoleName.STUDENT)
  async pdf(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { filename, buffer } = await this.certificates.buildPdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Post(':id/revoke')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  revoke(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.revoke(id, user);
  }

  @Post(':id/reissue')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  reissue(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.reissue(id, user);
  }
}
