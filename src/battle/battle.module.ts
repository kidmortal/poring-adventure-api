import { Module } from '@nestjs/common';
import { BattleService } from './battle.service';
import { BattleGateway } from './battle.gateway';

@Module({
  providers: [BattleGateway, BattleService],
})
export class BattleModule {}
