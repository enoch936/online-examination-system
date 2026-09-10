import { Module } from '@nestjs/common';
import { RealtimeModule } from '../websocket/realtime.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [RealtimeModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
