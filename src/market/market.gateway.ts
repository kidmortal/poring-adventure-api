import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MarketService } from './market.service';
import { CreateMarketDto } from './dto/create-market.dto';

@WebSocketGateway({ cors: true })
export class MarketGateway {
  constructor(private readonly marketService: MarketService) {}
  private logger = new Logger('Websocket');

  @SubscribeMessage('create_market_listing')
  async create(
    @MessageBody() createMarketDto: CreateMarketDto,
    @ConnectedSocket() client: Socket,
  ) {
    const email = client.handshake.auth.email;
    this.logger.debug('create_market_listing');
    return this.marketService.addItemToMarket(createMarketDto, email);
  }

  @SubscribeMessage('get_all_market_listing')
  async findAll() {
    this.logger.debug('get_all_market_listing');
    return this.marketService.findAll();
  }
}
