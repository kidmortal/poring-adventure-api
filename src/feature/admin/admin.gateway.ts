import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AdminService } from './admin.service';
import { Logger, UseFilters } from '@nestjs/common';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { UsersService } from 'src/feature/users/users.service';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway()
export class AdminGateway {
  constructor(
    private readonly adminService: AdminService,
    private readonly userService: UsersService,
    private readonly websocket: WebsocketService,
  ) {}
  private logger = new Logger('Websocket - admin');

  @SubscribeMessage('message_socket')
  async sendMessage(
    @MessageBody()
    args: {
      to: string;
      message: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('message_socket');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.websocket.sendTextNotification({
      email: args.to,
      text: args.message,
    });
  }

  @SubscribeMessage('get_all_connected_users')
  async getAllSockets(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_all_connected_users');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.getConnectedUsers({ userEmail: email });
  }

  @SubscribeMessage('get_server_info')
  async getServerInfo(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_server_info');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.getServerInfo({ userEmail: email });
  }

  @SubscribeMessage('restart_server')
  async restartServer(@ConnectedSocket() client: Socket) {
    this.logger.debug('restart_server');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.restartServer();
  }

  @SubscribeMessage('clear_all_cache')
  async clearRoutesCache(@ConnectedSocket() client: Socket) {
    this.logger.debug('clear_all_cache');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.clearCache();
  }

  @SubscribeMessage('send_push_notification')
  async sendPushNotification(
    @MessageBody()
    message: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('send_push_notification');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.sendPushNotification({ message });
  }

  @SubscribeMessage('send_gift_mail')
  async sendGiftMail(
    @MessageBody()
    receiverEmail: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('send_gift_mail');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.sendGiftMail({ userEmail: receiverEmail });
  }

  @SubscribeMessage('disconnect_user_websocket')
  async disconnectUserWebsocket(
    @MessageBody()
    disconnectEmail: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('disconnect_user_websocket');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.disconnectUserSocket({
      userEmail: disconnectEmail,
    });
  }

  @SubscribeMessage('send_push_notification_user')
  async sendPushNotificationToUser(
    @MessageBody()
    params: { email: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug('send_push_notification_user');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.adminService.sendPushNotificationToUser({
      message: params.message,
      userEmail: params.email,
    });
  }
}
