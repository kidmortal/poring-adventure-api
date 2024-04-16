import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { ItemsModule } from 'src/feature/items/items.module';
import { UsersModule } from 'src/feature/users/users.module';
import { MarketGateway } from './market.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ItemsModule,
    UsersModule,
    WebsocketModule,
    CacheModule.register({ ttl: 1000 * 60 * 10 }), // 10 minutes cache
  ],
  controllers: [],
  providers: [MarketService, MarketGateway],
})
export class MarketModule {}
