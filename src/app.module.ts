import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FirebaseModule } from './firebase/firebase.module';
import { ItemsModule } from './items/items.module';
import { MarketModule } from './market/market.module';

@Module({
  imports: [FirebaseModule, UsersModule, ItemsModule, MarketModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
