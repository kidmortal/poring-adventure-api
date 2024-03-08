import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { ItemsModule } from 'src/items/items.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [ItemsModule, UsersModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
