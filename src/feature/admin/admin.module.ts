import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGateway } from './admin.gateway';
import { UsersModule } from 'src/feature/users/users.module';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';
import { NotificationModule } from 'src/integrations/notification/notification.module';
import { MailModule } from 'src/feature/mail/mail.module';
import { GuildModule } from 'src/feature/guild/guild.module';
import { BattleModule } from 'src/feature/battle/battle.module';
import { ItemsModule } from 'src/feature/items/items.module';

@Module({
  imports: [
    UsersModule,
    WebsocketModule,
    NotificationModule,
    MailModule,
    GuildModule,
    BattleModule,
    ItemsModule,
    CacheModule.register({ ttl: 1000 * 60 * 10 }),
  ],
  providers: [AdminGateway, AdminService],
})
export class AdminModule {}
