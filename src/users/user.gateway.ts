import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';

import { Logger } from '@nestjs/common';
import { UsersService } from './users.service';

@WebSocketGateway({ cors: true })
export class UserGateway {
  constructor(private readonly userService: UsersService) {}
  private logger = new Logger('Websocket');

  @SubscribeMessage('get_user')
  async findOne(@MessageBody() email: string) {
    this.logger.debug('get_user');
    const user = await this.userService.findOne(email);
    if (!user) {
      return false;
    }
    return user;
  }
}
