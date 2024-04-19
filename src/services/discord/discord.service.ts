import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BattleService } from 'src/feature/battle/battle.service';
import { Discord as DiscordUser } from '@prisma/client';

@Injectable()
export class DiscordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly battleService: BattleService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}
  private cacheLogger = new Logger('Cache - Discord');
  private tokens: { [email: string]: string } = {};

  createRegisterToken(args: { userEmail: string }) {
    const registeredToken = this.tokens[args.userEmail];
    if (registeredToken) {
      return registeredToken;
    } else {
      const token = randomUUID();
      this.tokens[args.userEmail] = token;
      return token;
    }
  }

  findOne(args: { discordId: string }) {
    return this.prisma.user.findFirst({
      where: { discord: { discordId: args.discordId } },
      include: { appearance: true },
    });
  }

  async register(args: RegisterDiscordProfileDto) {
    console.log(args);
    const hasToken = this._findTokenByToken({ token: args.token });
    if (!hasToken) {
      return false;
    }
    const email = hasToken.key;
    const updateProfile = await this.prisma.discord.upsert({
      where: { userEmail: email },
      create: { discordId: args.id, name: args.name, url: args.url, userEmail: email },
      update: { discordId: args.id, name: args.name, url: args.url, userEmail: email },
      include: { user: true },
    });
    return updateProfile.user;
  }

  inventory(args: { discordId: string }) {
    return this.prisma.inventoryItem.findMany({
      where: { user: { discord: { discordId: args.discordId } } },
      include: { item: true },
    });
  }

  getdiscordProfileFromEmail(args: { userEmail: string }) {
    return this.prisma.discord.findUnique({ where: { userEmail: args.userEmail } });
  }

  async getBattle(args: { discordId: string }) {
    const user = await this._getDiscordProfileFromId({ discordId: args.discordId });
    if (!user) return false;
    const battle = this.battleService.getUserBattle(user.userEmail);
    if (!battle) return false;
    return battle.toJson();
  }

  private async _getDiscordProfileFromId(args: { discordId: string }): Promise<DiscordUser> {
    const cacheKey = `discord_user_${args.discordId}`;
    const cachedDiscordUser = await this.cache.get(cacheKey);
    if (cachedDiscordUser) {
      this.cacheLogger.log(`returning cached ${cacheKey}`);
      return cachedDiscordUser as DiscordUser;
    }
    const discordUser = await this.prisma.discord.findUnique({
      where: { discordId: args.discordId },
    });
    this.cache.set(cacheKey, discordUser);
    return discordUser;
  }

  private _findTokenByToken(args: { token: string }) {
    for (const entry of Object.entries(this.tokens)) {
      const [key, value] = entry;
      if (value === args.token) {
        return { key, value };
      }
    }
    return false;
  }
}
