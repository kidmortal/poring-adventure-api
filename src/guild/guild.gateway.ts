import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { GuildService } from './guild.service';

import { Logger, UseFilters } from '@nestjs/common';
import { WebsocketExceptionsFilter } from 'src/websocket/websocketException.filter';

@WebSocketGateway()
@UseFilters(WebsocketExceptionsFilter)
export class GuildGateway {
  constructor(private readonly guildService: GuildService) {}
  private logger = new Logger('Websocket - guilds');

  @SubscribeMessage('get_guild')
  findOne(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    if (!email) return false;
    this.logger.debug('get_guild');
    return this.guildService.getGuildFromUser({ userEmail: email });
  }

  @SubscribeMessage('find_all_guild')
  findAll() {
    this.logger.debug('find_all_guild');
    return this.guildService.findAll();
  }
}
