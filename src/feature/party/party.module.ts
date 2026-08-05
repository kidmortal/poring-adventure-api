import { Module } from '@nestjs/common';
import { PartyService } from './party.service';
import { PartyGateway } from './party.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';
import { PartyRepository } from './party.repository';
import { PartyNotifier } from './party.notifier';
import { PartyState } from './party.state';
import { UsersModule } from 'src/feature/users/users.module';

const providers = [PartyService, PartyRepository, PartyNotifier, PartyState];

@Module({
  // UsersModule for the profile cache: leaving a party has to drop the copy of
  // the member that still remembers being in one. It does not import this one
  // back, so there is no cycle to work around.
  imports: [UsersModule, WebsocketModule, CacheModule.register({ ttl: 1000 * 60 * 10 })], // 10 minutes cache
  providers: [...providers, PartyGateway],
  exports: providers,
})
export class PartyModule {}
