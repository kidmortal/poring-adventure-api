import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';

import { Logger, UseFilters } from '@nestjs/common';

import { WebsocketExceptionsFilter } from 'src/websocket/websocketException.filter';
import { DiscordService } from './discord.service';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class DiscordGateway {
  constructor(private readonly discordService: DiscordService) {}
  private logger = new Logger('Websocket - users');

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
