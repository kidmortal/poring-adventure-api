import { Module } from '@nestjs/common';
import { PartyService } from './party.service';
import { PartyGateway } from './party.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [WebsocketModule, CacheModule.register({ ttl: 1000 * 60 * 10 })], // 10 minutes cache
  providers: [PartyGateway, PartyService],
  exports: [PartyService],
})
export class PartyModule {}
