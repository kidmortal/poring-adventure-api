import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';

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

  @SubscribeMessage('register_discord_profile')
  async registerDiscord(@MessageBody() dto: RegisterDiscordProfileDto) {
    this.logger.debug(`'register_discord_profile' ${dto?.id}`);
    if (!dto?.id) return false;
    const user = await this.discordService.register(dto);
    return user;
  }

  @SubscribeMessage('get_profile')
  async discordIntegration(@ConnectedSocket() client: Socket) {
    this.logger.debug(`get_profile`);
    const email = client.handshake.auth.email;
    const user = await this.discordService.getdiscordProfileFromEmail({ userEmail: email });
    return user;
  }

  @SubscribeMessage('get_discord_battle')
  async getDiscordBattle(@MessageBody() dto: GetDiscordBattleDto) {
    this.logger.debug(`get_discord_battle`);
    return this.discordService.getBattle({ discordId: dto.discordId });
  }

  @SubscribeMessage('get_discord_user')
  async findOne(@MessageBody() dto: GetDiscordUserDto) {
    this.logger.debug(`'get_discord_user' ${dto.discordId}`);
    if (!dto.discordId) return false;

    const user = await this.discordService.findOne({ discordId: dto.discordId });
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
