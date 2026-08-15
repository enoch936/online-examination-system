import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { SubmissionsService } from './submissions.service';

@ApiBearerAuth()
@ApiTags('Submissions')
@Controller('submissions')
@Roles(RoleName.STUDENT)
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  submit(@Body() dto: SubmitExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.submissions.submit(dto, user.sub);
  }
}
