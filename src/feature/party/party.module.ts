import { Module } from '@nestjs/common';
import { PartyService } from './party.service';
import { PartyGateway } from './party.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';
import { PartyRepository } from './party.repository';
import { PartyNotifier } from './party.notifier';
import { PartyState } from './party.state';

const providers = [PartyService, PartyRepository, PartyNotifier, PartyState];

@Module({
  imports: [WebsocketModule, CacheModule.register({ ttl: 1000 * 60 * 10 })], // 10 minutes cache
  providers: [...providers, PartyGateway],
  exports: providers,
})
export class PartyModule {}
