import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { ItemsService } from './items.service';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class ItemsGateway {
  constructor(private readonly itemService: ItemsService) {}
  private logger = new Logger('Items');

  @SubscribeMessage('consume_item')
  async consumeItem(@MessageBody() itemId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('consume_item');
    return this.itemService.consumeItem({ userEmail: email, itemId, stack: 1 });
  }

  @SubscribeMessage('equip_item')
  async equipItem(@MessageBody() itemId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('equip_item');
    return this.itemService.equipItem({ userEmail: email, itemId });
  }

  @SubscribeMessage('unequip_item')
  async unequipItem(@MessageBody() itemId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('unequip_item');
    return this.itemService.unequipItem({ userEmail: email, itemId });
  }
}
