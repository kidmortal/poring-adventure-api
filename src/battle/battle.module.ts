import { Module } from '@nestjs/common';
import { BattleService } from './battle.service';
import { BattleGateway } from './battle.gateway';
import { UsersModule } from 'src/users/users.module';
import { MonstersModule } from 'src/monsters/monsters.module';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { ItemsModule } from 'src/items/items.module';
import { PartyModule } from 'src/party/party.module';

@Module({
  imports: [
    UsersModule,
    MonstersModule,
    ItemsModule,
    WebsocketModule,
    PartyModule,
  ],
  providers: [BattleGateway, BattleService],
})
export class BattleModule {}
