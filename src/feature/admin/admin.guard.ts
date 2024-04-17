import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToWs();
    const socket = request.getClient() as Socket;
    const email = socket.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin({ adminEmail: email });
    if (!isAdmin) {
      throw new ForbiddenException('This resource is for admin only');
    }
    return true;
  }
}
