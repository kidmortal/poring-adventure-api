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
import { PartyModule } from './party/party.module';
import { MainController } from './main.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SkillsModule } from './skills/skills.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { GuildModule } from './guild/guild.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
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
    PartyModule,
    SkillsModule,
    AdminModule,
    GuildModule,
    NotificationModule,
  ],
  controllers: [MainController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
