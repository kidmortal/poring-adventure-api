import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class WebsocketAuthEmailGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToWs();
    const socket = request.getClient() as Socket;
    const email = socket.handshake.auth.email;
    if (!email) {
      throw new ForbiddenException('This resource requires an authenticated email');
    }
    return true;
  }
}
