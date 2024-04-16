import { Module } from '@nestjs/common';
import { PartyService } from './party.service';
import { PartyGateway } from './party.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  providers: [PartyGateway, PartyService],
  exports: [PartyService],
})
export class PartyModule {}
