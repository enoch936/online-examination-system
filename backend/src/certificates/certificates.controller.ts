import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
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

  @Post(':resultId/issue')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  issue(@Param('resultId') resultId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificates.issue(resultId, user);
  }

  @Public()
  @Get('verify/:verificationCode')
  verify(@Param('verificationCode') verificationCode: string) {
    return this.certificates.verify(verificationCode);
  }
}
