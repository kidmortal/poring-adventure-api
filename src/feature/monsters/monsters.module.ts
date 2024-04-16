import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MonstersService } from './monsters.service';

import { MonsterGateway } from './monsters.gateway';

@Module({
  imports: [CacheModule.register({ ttl: 1000 * 60 * 10 })], // 10 minutes cache
  providers: [MonstersService, MonsterGateway],
  exports: [MonstersService],
})
export class MonstersModule {}
