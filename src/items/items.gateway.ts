import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
import { ItemsService } from './items.service';

@WebSocketGateway({ cors: true })
export class ItemsGateway {
  constructor(private readonly itemService: ItemsService) {}
  private logger = new Logger('Websocket');

  @SubscribeMessage('consume_item')
  async findOne(
    @MessageBody() itemId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug('consume_item');
    return this.itemService.consumeItem({ userEmail: email, itemId, stack: 1 });
  }
}
