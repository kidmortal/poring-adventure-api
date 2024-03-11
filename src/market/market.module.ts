import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { ItemsModule } from 'src/items/items.module';
import { UsersModule } from 'src/users/users.module';
import { MarketGateway } from './market.gateway';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [ItemsModule, UsersModule, WebsocketModule],
  controllers: [],
  providers: [MarketService, MarketGateway],
})
export class MarketModule {}
