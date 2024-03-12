import { Module } from '@nestjs/common';
import { PartyService } from './party.service';
import { PartyGateway } from './party.gateway';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  providers: [PartyGateway, PartyService],
})
export class PartyModule {}
