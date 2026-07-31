import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordGateway } from './discord.gateway';
import { DiscordBotGateway } from './discordBot.gateway';
import { BattleModule } from 'src/feature/battle/battle.module';
import { CacheModule } from '@nestjs/cache-manager';
import { DiscordActionsService } from './discordActions.service';
import { UsersModule } from 'src/feature/users/users.module';
import { ItemsModule } from 'src/feature/items/items.module';
import { MonstersModule } from 'src/feature/monsters/monsters.module';
import { GuildModule } from 'src/feature/guild/guild.module';
import { MarketModule } from 'src/feature/market/market.module';
import { PartyModule } from 'src/feature/party/party.module';
import { MailModule } from 'src/feature/mail/mail.module';
import { SkillsModule } from 'src/feature/skills/skills.module';

@Module({
  imports: [
    BattleModule,
    UsersModule,
    ItemsModule,
    MonstersModule,
    GuildModule,
    MarketModule,
    PartyModule,
    MailModule,
    SkillsModule,
    CacheModule.register({ ttl: 1000 * 60 * 10 }), // 10 minutes cache
  ],
  providers: [DiscordGateway, DiscordBotGateway, DiscordService, DiscordActionsService],
})
export class DiscordModule {}
