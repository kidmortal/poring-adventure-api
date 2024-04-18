import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';

import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { DiscordService } from './discord.service';
import { RegisterDiscordProfilePayload } from './dto/register';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class DiscordGateway {
  constructor(private readonly discordService: DiscordService) {}
  private logger = new Logger('Websocket - users');

  @SubscribeMessage('create_discord_register_token')
  async createToken(@ConnectedSocket() client: Socket) {
    this.logger.debug(`create_discord_register_token`);
    const email = client.handshake.auth.email;
    const token = this.discordService.createRegisterToken({ userEmail: email });
    return token;
  }

  @SubscribeMessage('register_discord_profile')
  async registerDiscord(@MessageBody() args: RegisterDiscordProfilePayload) {
    this.logger.debug(`'register_discord_profile' ${args?.id}`);
    if (!args?.id) return false;
    const user = await this.discordService.register(args);
    return user;
  }

  @SubscribeMessage('get_profile')
  async discordIntegration(@ConnectedSocket() client: Socket) {
    this.logger.debug(`get_profile`);
    const email = client.handshake.auth.email;
    const user = await this.discordService.discordProfile({ userEmail: email });
    return user;
  }

  @SubscribeMessage('get_discord_user')
  async findOne(@MessageBody() discordId: string) {
    this.logger.debug(`'get_discord_user' ${discordId}`);
    if (!discordId) return false;

    const user = await this.discordService.findOne({ discordId });
    return user;
  }

  @SubscribeMessage('get_discord_user_inventory')
  async getUserInventory(@MessageBody() discordId: string) {
    this.logger.debug(`'get_discord_user_inventory' ${discordId}`);
    if (!discordId) return false;

    const inventory = await this.discordService.inventory({ discordId });
    return inventory;
  }
}
