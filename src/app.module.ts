import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FirebaseModule } from './firebase/firebase.module';
import { ItemsModule } from './items/items.module';
import { MarketModule } from './market/market.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { MonstersModule } from './monsters/monsters.module';
import { BattleModule } from './battle/battle.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 30000,
        limit: 60,
      },
    ]),
    FirebaseModule,
    UsersModule,
    ItemsModule,
    MarketModule,
    MonstersModule,
    BattleModule,
    WebsocketModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
