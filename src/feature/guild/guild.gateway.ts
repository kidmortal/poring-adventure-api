import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { GuildService } from './guild.service';

import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';
import { GuildTaskService } from './guildTask.service';
import { GuildBlessingService } from './guildBlessing.service';
import { GuildApplicationService } from './guildApplication.service';
import { GuildBossService } from './guildBoss.service';
import { GuildStoreService } from './guildStore.service';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway()
export class GuildGateway {
  constructor(
    private readonly guildService: GuildService,
    private readonly taskService: GuildTaskService,
    private readonly blessingService: GuildBlessingService,
    private readonly applicationService: GuildApplicationService,
    private readonly bossService: GuildBossService,
    private readonly storeService: GuildStoreService,
  ) {}
  private logger = new Logger('Websocket - guilds');

  @SubscribeMessage('get_guild')
  findOne(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;

    this.logger.debug('get_guild');
    return this.guildService.getGuildFromUser({ userEmail: email });
  }

  @SubscribeMessage('find_all_guild')
  findAll() {
    this.logger.debug('find_all_guild');
    return this.guildService.findAll();
  }

  @SubscribeMessage('kick_from_guild')
  kickFromGuild(@MessageBody() dto: KickFromGuildDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('kick_from_guild');
    return this.guildService.kickFromGuild({ userEmail: email, kickEmail: dto.userEmail });
  }

  @SubscribeMessage('quit_from_guild')
  quitFromGuild(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('quit_from_guild');
    return this.guildService.quitFromGuild({ userEmail: email });
  }

  @SubscribeMessage('apply_to_guild')
  applyToGuild(@MessageBody() dto: ApplyToGuildDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('apply_to_guild');
    return this.applicationService.applyToGuild({ userEmail: email, guildId: dto.guildId });
  }

  @SubscribeMessage('accept_guild_application')
  acceptGuildApplication(@MessageBody() dto: AcceptGuildApplicationDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('accept_guild_application');
    return this.applicationService.acceptGuildApplication({
      userEmail: email,
      applicationId: dto.applicationId,
    });
  }

  @SubscribeMessage('refuse_guild_application')
  refuseGuildApplication(@MessageBody() dto: RefuseGuildApplicationDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('refuse_guild_application');
    return this.applicationService.refuseGuildApplication({
      userEmail: email,
      applicationId: dto.applicationId,
    });
  }

  @SubscribeMessage('get_available_guild_tasks')
  getTasks() {
    this.logger.debug('get_available_guild_tasks');
    return this.taskService.findAllGuildTasks();
  }

  @SubscribeMessage('accept_guild_task')
  acceptGuilkdTask(@MessageBody() dto: AcceptGuildTaskDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('accept_guild_task');
    return this.taskService.acceptTask({ userEmail: email, taskId: dto.taskId });
  }

  @SubscribeMessage('cancel_guild_task')
  cancelGuildTask(@MessageBody() dto: CancelGuildTaskDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('cancel_guild_task');
    return this.taskService.cancelCurrentTask({ userEmail: email });
  }

  @SubscribeMessage('finish_current_task')
  finishQuest(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('finish_current_task');
    return this.taskService.finishCurrentTask({ userEmail: email });
  }

  @SubscribeMessage('get_guild_bosses')
  getGuildBosses() {
    this.logger.debug('get_guild_bosses');
    return this.bossService.findAllBosses();
  }

  @SubscribeMessage('get_guild_boss')
  getCurrentGuildBoss(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('get_guild_boss');
    return this.bossService.notifyUserWithBoss({ userEmail: email });
  }

  @SubscribeMessage('summon_guild_boss')
  summonGuildBoss(@MessageBody() dto: SummonGuildBossDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`summon_guild_boss ${dto.bossId} ${dto.difficulty}`);
    return this.bossService.summon({ userEmail: email, bossId: dto.bossId, difficulty: dto.difficulty });
  }

  @SubscribeMessage('dismiss_guild_boss')
  dismissGuildBoss(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('dismiss_guild_boss');
    return this.bossService.dismiss({ userEmail: email });
  }

  @SubscribeMessage('get_guild_store')
  getGuildStore() {
    this.logger.debug('get_guild_store');
    return this.storeService.findAllProducts();
  }

  @SubscribeMessage('buy_guild_store_product')
  buyGuildStoreProduct(@MessageBody() dto: BuyGuildStoreProductDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`buy_guild_store_product ${dto.productId}`);
    return this.storeService.buy({ userEmail: email, productId: dto.productId, amount: dto.amount ?? 1 });
  }

  @SubscribeMessage('unlock_blessing')
  unlockBlessing(@MessageBody() dto: UnlockBlessingsDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('unlock_blessing');
    return this.blessingService.unlockGuildBlessings({ userEmail: email, guildId: dto.guildId });
  }

  @SubscribeMessage('upgrade_blessing')
  upgradeBlessing(@MessageBody() dto: UpgradeBlessingsDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`upgrade_blessing ${dto.blessing}`);
    return this.blessingService.upgradeGuildBlessing({
      userEmail: email,
      guildId: dto.guildId,
      blessing: dto.blessing,
    });
  }
}
