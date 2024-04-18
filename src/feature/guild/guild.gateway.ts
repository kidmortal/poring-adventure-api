import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { GuildService } from './guild.service';

import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway()
export class GuildGateway {
  constructor(private readonly guildService: GuildService) {}
  private logger = new Logger('Websocket - guilds');

  @SubscribeMessage('get_guild')
  findOne(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;

    this.logger.debug('get_guild');
    return this.guildService.getGuildFromUser({ userEmail: email });
  }

  @SubscribeMessage('apply_to_guild')
  applyToGuild(@MessageBody() guildId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('apply_to_guild');
    return this.guildService.applyToGuild({ userEmail: email, guildId });
  }

  @SubscribeMessage('kick_from_guild')
  kickFromGuild(@MessageBody() kickEmail: string, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('kick_from_guild');
    return this.guildService.kickFromGuild({ userEmail: email, kickEmail });
  }

  @SubscribeMessage('quit_from_guild')
  quitFromGuild(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('quit_from_guild');
    return this.guildService.quitFromGuild({ userEmail: email });
  }

  @SubscribeMessage('accept_guild_application')
  acceptGuildApplication(@MessageBody() applicationId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('accept_guild_application');
    return this.guildService.acceptGuildApplication({
      userEmail: email,
      applicationId,
    });
  }

  @SubscribeMessage('refuse_guild_application')
  refuseGuildApplication(@MessageBody() applicationId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('refuse_guild_application');
    return this.guildService.refuseGuildApplication({
      userEmail: email,
      applicationId,
    });
  }

  @SubscribeMessage('finish_current_task')
  finishQuest(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('finish_current_task');
    return this.guildService.finishCurrentTask({ userEmail: email });
  }

  @SubscribeMessage('accept_guild_task')
  acceptGuilkdTask(@MessageBody() taskId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('accept_guild_task');
    return this.guildService.acceptTask({ userEmail: email, taskId });
  }

  @SubscribeMessage('cancel_guild_task')
  cancelGuildTask(@MessageBody() taskId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('cancel_guild_task');
    return this.guildService.cancelCurrentTask({ userEmail: email });
  }

  @SubscribeMessage('find_all_guild')
  findAll() {
    this.logger.debug('find_all_guild');
    return this.guildService.findAll();
  }

  @SubscribeMessage('get_available_guild_tasks')
  getTasks() {
    this.logger.debug('get_available_guild_tasks');
    return this.guildService.findAllGuidTasks();
  }
}
