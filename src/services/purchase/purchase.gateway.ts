import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { Logger, UseFilters, UseGuards } from '@nestjs/common';

import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { PurchaseService } from './purchase.service';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseFilters(WebsocketExceptionsFilter)
@UseGuards(WebsocketAuthEmailGuard)
@WebSocketGateway({ cors: true })
export class PurchaseGateway {
  constructor(private readonly purchaseService: PurchaseService) {}
  private logger = new Logger('Purchases');

  @SubscribeMessage('get_purchases')
  async getPurchases(@ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('get_purchases');

    return this.purchaseService.findAll({ userEmail: email });
  }

  @SubscribeMessage('refund_purchase')
  async refundPurchase(@MessageBody() purchaseId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('refund_purchase');
    return this.purchaseService.requestRefund({ userEmail: email, purchaseId });
  }

  @SubscribeMessage('claim_purchase')
  async claimPurchase(@MessageBody() purchaseId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('claim_purchase');
    return this.purchaseService.claimPurchase({ userEmail: email, purchaseId });
  }
}
