import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CertificatesService } from './certificates.service';

@ApiBearerAuth()
@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Post(':resultId/issue')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  issue(@Param('resultId') resultId: string) {
    return this.certificates.issue(resultId);
  }

  @Public()
  @Get('verify/:verificationCode')
  verify(@Param('verificationCode') verificationCode: string) {
    return this.certificates.verify(verificationCode);
  }
}
