import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersGateway } from './users.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [WebsocketModule, CacheModule.register({ ttl: 1000 * 60 * 1 })], // 1 minute cache
  controllers: [],
  providers: [UsersService, UsersGateway],
  exports: [UsersService],
})
export class UsersModule {}
