import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreatePushSubscriptionDto, DeletePushSubscriptionDto } from './dto/push-subscription.dto';
import { PushService } from './push.service';

@ApiTags('Push')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Public()
  @Get('vapid-key')
  vapidKey() {
    return { publicKey: this.push.vapidPublicKey };
  }

  @ApiBearerAuth()
  @Post('subscriptions')
  subscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePushSubscriptionDto) {
    return this.push.saveSubscription(user.sub, dto);
  }

  @ApiBearerAuth()
  @Delete('subscriptions')
  unsubscribe(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeletePushSubscriptionDto) {
    return this.push.removeSubscription(user.sub, dto.endpoint);
  }
}