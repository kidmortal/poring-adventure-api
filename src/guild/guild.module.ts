import { Module } from '@nestjs/common';
import { GuildService } from './guild.service';
import { GuildGateway } from './guild.gateway';
import { CacheModule } from '@nestjs/cache-manager';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    WebsocketModule,
    NotificationModule,
    CacheModule.register({ ttl: 1000 * 60 * 10 }),
  ], // 10 minutes cache
  providers: [GuildGateway, GuildService],
  exports: [GuildService],
})
export class GuildModule {}
