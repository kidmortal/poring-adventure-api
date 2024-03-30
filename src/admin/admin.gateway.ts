import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AdminService } from './admin.service';
import { Logger } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { WebsocketService } from 'src/websocket/websocket.service';

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

  @SubscribeMessage('get_all_sockets')
  async getAllSockets(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_all_sockets');
    const email = client.handshake.auth.email;
    const isAdmin = await this.userService.isAdmin(email);
    if (!isAdmin) {
      return this.websocket.breakUserConnection(email);
    }
    return this.websocket.getAllSockets();
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
}
