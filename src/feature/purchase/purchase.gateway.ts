import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { Socket } from 'socket.io';

import { BadRequestException, Logger, UseFilters, UseGuards } from '@nestjs/common';

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
    this.logger.debug(`refund_purchase ${purchaseId}`);

    return this.purchaseService.requestRefund({ userEmail: email, purchaseId: this._parseId(purchaseId) });
  }

  @SubscribeMessage('claim_purchase')
  async claimPurchase(@MessageBody() purchaseId: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug(`claim_purchase ${purchaseId}`);

    return this.purchaseService.claimPurchase({ userEmail: email, purchaseId: this._parseId(purchaseId) });
  }

  private _parseId(purchaseId: number) {
    const id = Number(purchaseId);
    if (!Number.isInteger(id)) {
      throw new BadRequestException('A valid purchase id is required');
    }
    return id;
  }
}
