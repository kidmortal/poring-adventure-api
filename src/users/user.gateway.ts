import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { WebsocketService } from 'src/websocket/websocket.service';

@WebSocketGateway({ cors: true })
export class UserGateway {
  constructor(
    private readonly userService: UsersService,
    private readonly websocket: WebsocketService,
  ) {}
  private logger = new Logger('Websocket - users');

  @SubscribeMessage('get_user')
  async findOne(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`'get_user' ${email}`);
    if (!email) {
      return;
    }
    const user = await this.userService.findOne(email);
    if (!user) {
      return false;
    }
    this.userService.notifyUserUpdate({
      email,
      payload: user,
    });
    return user;
  }

  @SubscribeMessage('get_all_user')
  async findAll() {
    this.logger.debug('get_all_user');
    const users = await this.userService.findAll();
    return users;
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
    return this.websocket.sendTextNotification(args.to, args.message);
  }
}
