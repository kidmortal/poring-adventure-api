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
  async consumeItem(@MessageBody() dto: ConsumeItemDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('consume_item');
    return this.itemService.consumeItem({ userEmail: email, inventoryId: dto.inventoryId, stack: 1 });
  }

  @SubscribeMessage('equip_item')
  async equipItem(@MessageBody() dto: EquipItemDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('equip_item');
    return this.itemService.equipItem({ userEmail: email, inventoryId: dto.inventoryId });
  }

  @SubscribeMessage('unequip_item')
  async unequipItem(@MessageBody() dto: UnequipItemDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('unequip_item');
    return this.itemService.unequipItem({ userEmail: email, inventoryId: dto.inventoryId });
  }
}
