import { WebSocketGateway, SubscribeMessage, ConnectedSocket } from '@nestjs/websockets';

import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { DiscordService } from './discord.service';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class DiscordGateway {
  constructor(private readonly discordService: DiscordService) {}
  private logger = new Logger('Websocket - discord');

  @SubscribeMessage('create_discord_register_token')
  async createToken(@ConnectedSocket() client: Socket) {
    this.logger.debug(`create_discord_register_token`);
    const email = client.handshake.auth.email;
    const token = this.discordService.createRegisterToken({ userEmail: email });
    return token;
  }

  @SubscribeMessage('get_profile')
  async discordIntegration(@ConnectedSocket() client: Socket) {
    this.logger.debug(`get_profile`);
    const email = client.handshake.auth.email;
    const user = await this.discordService.getdiscordProfileFromEmail({ userEmail: email });
    return user;
  }
}
