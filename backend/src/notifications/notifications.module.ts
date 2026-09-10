import { Module } from '@nestjs/common';
import { PushModule } from '../push-notifications/push.module';
import { RealtimeModule } from '../websocket/realtime.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [RealtimeModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
