import { Module } from '@nestjs/common';
import { MonstersService } from './monsters.service';

import { MonsterGateway } from './monsters.gateway';

@Module({
  providers: [MonstersService, MonsterGateway],
  exports: [MonstersService],
})
export class MonstersModule {}
