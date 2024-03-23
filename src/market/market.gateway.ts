import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, UseFilters } from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { PurchaseMarketDto } from './dto/purchase-market.dto';
import { WebsocketExceptionsFilter } from 'src/websocket/websocketException.filter';

@UseFilters(WebsocketExceptionsFilter)
@WebSocketGateway({ cors: true })
export class MarketGateway {
  constructor(private readonly marketService: MarketService) {}
  private logger = new Logger('Websocket - market');

  @SubscribeMessage('create_market_listing')
  async create(
    @MessageBody() createMarketDto: CreateMarketDto,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug('create_market_listing');
    const result = await this.marketService.addItemToMarket(
      createMarketDto,
      email,
    );
    this.marketService.notifyMarketUsers();
    return result;
  }

  @SubscribeMessage('purchase_market_listing')
  async purchase(
    @MessageBody() purchaseDto: PurchaseMarketDto,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug('purchase_market_listing');
    const result = await this.marketService.purchase({
      marketListingId: purchaseDto.marketListingId,
      stacks: purchaseDto.stack,
      buyerEmail: email,
    });
    this.marketService.notifyMarketUsers();
    return result;
  }

  @SubscribeMessage('remove_market_listing')
  async remove(@MessageBody() id: number, @ConnectedSocket() client: Socket) {
    const email = client.handshake.auth.email;
    this.logger.debug('remove_market_listing');
    const result = await this.marketService.remove(id, email);
    this.marketService.notifyMarketUsers();
    return result;
  }

  @SubscribeMessage('get_all_market_listing')
  async findAll() {
    this.logger.debug('get_all_market_listing');
    return this.marketService.findAll();
  }
}
