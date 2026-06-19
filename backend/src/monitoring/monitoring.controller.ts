import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'online-examination-system-api',
      checkedAt: new Date().toISOString(),
    };
  }
}
