import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
import { UsersService } from './users.service';

@WebSocketGateway({ cors: true })
export class UserGateway {
  constructor(private readonly userService: UsersService) {}
  private logger = new Logger('Websocket - users');

  @SubscribeMessage('get_user')
  async findOne(@ConnectedSocket() client: Socket) {
    this.logger.debug('get_user');
    const email = client.handshake.auth.email;
    console.log(`email provided ${email}`);
    if (!email) {
      return;
    }
    const user = await this.userService.findOne(email);
    if (!user) {
      return false;
    }
    return user;
  }

  @SubscribeMessage('get_all_user')
  async findAll() {
    this.logger.debug('get_all_user');
    const users = await this.userService.findAll();
    return users;
  }
}
