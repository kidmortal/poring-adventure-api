import { Module } from '@nestjs/common';
import { GuildService } from './guild.service';
import { GuildGateway } from './guild.gateway';
import { CacheModule } from '@nestjs/cache-manager';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { NotificationModule } from 'src/services/notification/notification.module';
import { UsersModule } from 'src/feature/users/users.module';

@Module({
  imports: [WebsocketModule, NotificationModule, UsersModule, CacheModule.register({ ttl: 1000 * 60 * 10 })], // 10 minutes cache
  providers: [GuildGateway, GuildService],
  exports: [GuildService],
})
export class GuildModule {}
