import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { MarketService } from './market.service';
import { WebsocketExceptionsFilter } from 'src/core/websocket/websocketException.filter';
import { WebsocketAuthEmailGuard } from 'src/core/websocket/websocket.guard';

@UseGuards(WebsocketAuthEmailGuard)
@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class MarketGateway {
  constructor(private readonly marketService: MarketService) {}
  private logger = new Logger('Websocket - market');

  @SubscribeMessage('create_market_listing')
  async create(@MessageBody() dto: CreateMarketListingDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('create_market_listing');
    const result = await this.marketService.addItemToMarket({
      inventoryId: dto.inventoryId,
      price: dto.price,
      stack: dto.stack,
      sellerEmail: email,
    });
    return result;
  }

  @SubscribeMessage('purchase_market_listing')
  async purchase(@MessageBody() dto: PuchaseMarketListingDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('purchase_market_listing');
    const result = await this.marketService.purchase({
      marketListingId: dto.marketListingId,
      stacks: dto.stack,
      buyerEmail: email,
    });
    return result;
  }

  @SubscribeMessage('remove_market_listing')
  async remove(@MessageBody() dto: RemoveMarketListingDto, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('remove_market_listing');
    const result = await this.marketService.remove({ marketListingId: dto.marketListingId, userEmail: email });
    return result;
  }

  @SubscribeMessage('get_all_market_listing')
  async findAll(@MessageBody() dto: GetAllMarketListingDto) {
    this.logger.debug('get_all_market_listing');
    return this.marketService.findAll({ page: dto.page, category: dto.category });
  }
}
