import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordGateway } from './discord.gateway';

@Module({
  providers: [DiscordGateway, DiscordService],
})
export class DiscordModule {}
