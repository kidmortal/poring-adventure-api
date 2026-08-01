import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersGateway } from './users.gateway';
import { WebsocketModule } from 'src/core/websocket/websocket.module';
import { CacheModule } from '@nestjs/cache-manager';
import { UsersRepository } from './users.repository';
import { UserStatsService } from './userStats.service';
import { UserWalletService } from './userWallet.service';
import { UserStaminaService } from './userStamina.service';

const providers = [UsersService, UsersRepository, UserStatsService, UserWalletService, UserStaminaService];

@Module({
  imports: [WebsocketModule, CacheModule.register({ ttl: 1000 * 60 * 1 })], // 1 minute cache
  controllers: [],
  providers: [...providers, UsersGateway],
  exports: providers,
})
export class UsersModule {}
