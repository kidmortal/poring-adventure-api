import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Socket } from 'socket.io';

/** The identity `AuthService` stamps on the discord bot's service socket. */
export const DISCORD_SERVICE_EMAIL = 'discord';

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

/**
 * Discord events act on behalf of whatever `discordId` they are handed, so they
 * must only ever be reachable by the bot itself — a player socket could
 * otherwise read and mutate any linked account.
 */
@Injectable()
export class WebsocketDiscordServiceGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient() as Socket;
    if (socket.handshake.auth.email !== DISCORD_SERVICE_EMAIL) {
      throw new ForbiddenException('This resource is restricted to the discord integration');
    }
    return true;
  }
}
