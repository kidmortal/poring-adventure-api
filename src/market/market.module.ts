import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { ItemsModule } from 'src/items/items.module';
import { UsersModule } from 'src/users/users.module';
import { MarketGateway } from './market.gateway';

@Module({
  imports: [ItemsModule, UsersModule],
  controllers: [],
  providers: [MarketService, MarketGateway],
})
export class MarketModule {}
