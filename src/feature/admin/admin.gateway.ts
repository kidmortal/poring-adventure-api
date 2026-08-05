import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AdminService } from './admin.service';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { UsersService } from 'src/feature/users/users.service';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';
import { AdminGuard } from './admin.guard';

@UseFilters(WebsocketExceptionsFilter)
@UseGuards(WebsocketAuthEmailGuard)
@UseGuards(AdminGuard)
@WebSocketGateway()
export class AdminGateway {
  constructor(
    private readonly adminService: AdminService,
    private readonly userService: UsersService,
    private readonly websocket: WebsocketService,
  ) {}
  private logger = new Logger('Websocket - admin');

  @SubscribeMessage('message_socket')
  async sendMessage(@MessageBody() args: { to: string; message: string }) {
    this.logger.debug('message_socket');

    return this.websocket.sendTextNotification({
      email: args.to,
      text: args.message,
    });
  }

  @SubscribeMessage('get_all_connected_users')
  async getAllSockets(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_all_connected_users');
    const email = client.handshake.auth.email;
    return this.adminService.getConnectedUsers({ userEmail: email });
  }

  @SubscribeMessage('full_heal_user')
  async fullHealUser(@MessageBody() healEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug('full_heal_user');
    const email = client.handshake.auth.email;
    return this.adminService.fullHealUser({ userEmail: email, healEmail });
  }

  @SubscribeMessage('kill_user')
  async killUser(@MessageBody() killEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug('kill_user');
    const email = client.handshake.auth.email;
    return this.adminService.killUser({ userEmail: email, killEmail });
  }

  @SubscribeMessage('get_server_info')
  async getServerInfo(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_server_info');
    const email = client.handshake.auth.email;
    return this.adminService.getServerInfo({ userEmail: email });
  }

  @SubscribeMessage('restart_server')
  async restartServer() {
    this.logger.debug('restart_server');
    return this.adminService.restartServer();
  }

  @SubscribeMessage('clear_all_cache')
  async clearRoutesCache() {
    this.logger.debug('clear_all_cache');
    return this.adminService.clearCache();
  }

  @SubscribeMessage('send_push_notification')
  async sendPushNotification(@MessageBody() message: string) {
    this.logger.debug('send_push_notification');
    return this.adminService.sendPushNotification({ message });
  }

  @SubscribeMessage('send_gift_mail')
  async sendGiftMail(@MessageBody() receiverEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug('send_gift_mail');
    const email = client.handshake.auth.email;
    return this.adminService.sendGiftMail({ userEmail: email, receiverEmail });
  }

  @SubscribeMessage('disconnect_user_websocket')
  async disconnectUserWebsocket(@MessageBody() disconnectEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug('disconnect_user_websocket');
    const email = client.handshake.auth.email;
    return this.adminService.disconnectUserSocket({
      userEmail: email,
      disconnectEmail,
    });
  }

  /** Both daily resets take an email, or nothing at all to reset everyone. */
  @SubscribeMessage('reset_daily_stamina')
  async resetDailyStamina(@MessageBody() targetEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug(`reset_daily_stamina ${targetEmail || 'all'}`);
    const email = client.handshake.auth.email;
    return this.adminService.resetDailyStamina({ userEmail: email, targetEmail: targetEmail || undefined });
  }

  @SubscribeMessage('reset_boss_entry')
  async resetBossEntry(@MessageBody() targetEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug(`reset_boss_entry ${targetEmail || 'all'}`);
    const email = client.handshake.auth.email;
    return this.adminService.resetBossEntry({ userEmail: email, targetEmail: targetEmail || undefined });
  }

  @SubscribeMessage('clear_guild_bosses')
  async clearGuildBosses(@ConnectedSocket() client: Socket) {
    this.logger.debug('clear_guild_bosses');
    const email = client.handshake.auth.email;
    return this.adminService.clearGuildBosses({ userEmail: email });
  }

  @SubscribeMessage('give_silver')
  async giveSilver(@MessageBody() params: { email: string; amount: number }, @ConnectedSocket() client: Socket) {
    this.logger.debug(`give_silver ${params.email}`);
    const email = client.handshake.auth.email;
    return this.adminService.giveSilver({
      userEmail: email,
      receiverEmail: params.email,
      amount: params.amount,
    });
  }

  @SubscribeMessage('force_end_battle')
  async forceEndBattle(@MessageBody() targetEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug(`force_end_battle ${targetEmail}`);
    const email = client.handshake.auth.email;
    return this.adminService.forceEndBattle({ userEmail: email, targetEmail });
  }

  /** No email kills the monsters in the admin's own fight. */
  @SubscribeMessage('kill_battle_monsters')
  async killBattleMonsters(@MessageBody() targetEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug(`kill_battle_monsters ${targetEmail || 'self'}`);
    const email = client.handshake.auth.email;
    return this.adminService.killBattleMonsters({ userEmail: email, targetEmail: targetEmail || undefined });
  }

  /**
   * One event for every battle debug action, rather than a dozen of them: they
   * differ only in the verb, and the client sends the verb.
   */
  @SubscribeMessage('battle_debug_action')
  async battleDebugAction(@MessageBody() params: BattleDebugActionDto, @ConnectedSocket() client: Socket) {
    this.logger.debug(`battle_debug_action ${params?.action}`);
    const email = client.handshake.auth.email;
    return this.adminService.runBattleDebugAction({
      userEmail: email,
      action: params.action,
      targetEmail: params.email || undefined,
      name: params.name,
      amount: params.amount,
    });
  }

  @SubscribeMessage('clear_user_cache')
  async clearUserCache(@MessageBody() targetEmail: string, @ConnectedSocket() client: Socket) {
    this.logger.debug(`clear_user_cache ${targetEmail}`);
    const email = client.handshake.auth.email;
    return this.adminService.clearUserCache({ userEmail: email, targetEmail });
  }

  @SubscribeMessage('send_push_notification_user')
  async sendPushNotificationToUser(
    @MessageBody() params: { email: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('send_push_notification_user');
    const email = client.handshake.auth.email;
    return this.adminService.sendPushNotificationToUser({
      message: params.message,
      userEmail: email,
      receiverEmail: params.email,
    });
  }
}
