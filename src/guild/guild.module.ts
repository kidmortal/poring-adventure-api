import { Module } from '@nestjs/common';
import { GuildService } from './guild.service';
import { GuildGateway } from './guild.gateway';
import { CacheModule } from '@nestjs/cache-manager';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [WebsocketModule, CacheModule.register({ ttl: 1000 * 60 * 10 })], // 10 minutes cache
  providers: [GuildGateway, GuildService],
})
export class GuildModule {}
