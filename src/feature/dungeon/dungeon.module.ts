import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { UsersModule } from 'src/feature/users/users.module';
import { DungeonService } from './dungeon.service';
import { DungeonGateway } from './dungeon.gateway';

@Module({
  imports: [
    WebsocketModule,
    UsersModule,
    CacheModule.register({ ttl: 1000 * 60 * 10 }), // 10 minutes cache
  ],
  providers: [DungeonService, DungeonGateway],
  exports: [DungeonService],
})
export class DungeonModule {}
