import { Module } from '@nestjs/common';
import { BattleService } from './battle.service';
import { BattleGateway } from './battle.gateway';
import { UsersModule } from 'src/feature/users/users.module';
import { MonstersModule } from 'src/feature/monsters/monsters.module';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { ItemsModule } from 'src/feature/items/items.module';
import { PartyModule } from 'src/feature/party/party.module';
import { GuildModule } from 'src/feature/guild/guild.module';

@Module({
  imports: [UsersModule, MonstersModule, ItemsModule, WebsocketModule, PartyModule, GuildModule],
  providers: [BattleGateway, BattleService],
})
export class BattleModule {}
