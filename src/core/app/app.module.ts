import { Module } from '@nestjs/common';

import { FirebaseModule } from '../../services/firebase/firebase.module';
import { ItemsModule } from '../../feature/items/items.module';
import { MarketModule } from '../../feature/market/market.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { BattleModule } from '../../feature/battle/battle.module';
import { WebsocketModule } from '../websocket/websocket.module';

import { MainController } from './app.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { PrismaModule } from 'src/core/prisma/prisma.module';
import { AdminModule } from 'src/feature/admin/admin.module';
import { GuildModule } from 'src/feature/guild/guild.module';
import { MailModule } from 'src/feature/mail/mail.module';
import { DiscordModule } from 'src/services/discord/discord.module';
import { NotificationModule } from 'src/services/notification/notification.module';
import { PurchaseModule } from 'src/services/purchase/purchase.module';
import { UsersModule } from 'src/feature/users/users.module';
import { MonstersModule } from 'src/feature/monsters/monsters.module';
import { PartyModule } from 'src/feature/party/party.module';
import { SkillsModule } from 'src/feature/skills/skills.module';

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
    MailModule,
    DiscordModule,
    NotificationModule,
    PurchaseModule,
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
