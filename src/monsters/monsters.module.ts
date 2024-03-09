import { Module } from '@nestjs/common';
import { MonstersService } from './monsters.service';

import { MonsterGateway } from './monsters.gateway';

@Module({
  controllers: [],
  providers: [MonstersService, MonsterGateway],
})
export class MonstersModule {}
