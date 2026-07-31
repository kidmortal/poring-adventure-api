import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordGateway } from './discord.gateway';
import { BattleModule } from 'src/feature/battle/battle.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [BattleModule, CacheModule.register({ ttl: 1000 * 60 * 10 })], // 10 minutes cache
  providers: [DiscordGateway, DiscordService],
})
export class DiscordModule {}
