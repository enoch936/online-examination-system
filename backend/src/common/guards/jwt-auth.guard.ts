import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // This guard is registered globally, so it also runs for WebSocket
    // handlers. There is no HTTP req/headers to read the JWT from — the
    // gateway authenticates the socket once at connection time and stashes
    // the user on client.data (available to every handler via getUser). If we
    // let passport run here it crashed with "Cannot read properties of
    // undefined (reading 'authorization')" and killed every realtime handler.
    if (context.getType<string>() !== 'http') {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
