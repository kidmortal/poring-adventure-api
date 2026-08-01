import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BattleService } from 'src/feature/battle/battle.service';
import { Discord as DiscordUser } from '@prisma/client';

/** Registration tokens are short lived: the player has 10 minutes to paste it on discord. */
const REGISTER_TOKEN_TTL_MS = 1000 * 60 * 10;

type RegisterToken = { token: string; userEmail: string; expiresAt: number };

@Injectable()
export class DiscordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly battleService: BattleService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly cacheLogger = new Logger('Cache - Discord');
  private readonly logger = new Logger('Discord - service');
  private readonly registerTokens = new Map<string, RegisterToken>();

  /** Returns the pending token for the user, or issues a fresh one when there is none. */
  createRegisterToken(args: { userEmail: string }) {
    const pending = this.registerTokens.get(args.userEmail);
    if (pending && pending.expiresAt > Date.now()) {
      return pending.token;
    }
    const token = randomUUID();
    this.registerTokens.set(args.userEmail, {
      token,
      userEmail: args.userEmail,
      expiresAt: Date.now() + REGISTER_TOKEN_TTL_MS,
    });
    return token;
  }

  /**
   * Resolves the game account behind a discord id. Every discord action goes
   * through here, so an unlinked discord user can never act on someone's data.
   */
  async requireUserEmail(args: { discordId: string }) {
    const profile = await this._getDiscordProfileFromId({ discordId: args.discordId });
    if (!profile) {
      throw new ForbiddenException('This discord account is not linked to a Poring profile, use /register first');
    }
    return profile.userEmail;
  }

  findOne(args: { discordId: string }) {
    return this.prisma.user.findFirst({
      where: { discord: { discordId: args.discordId } },
      include: { appearance: true },
    });
  }

  /** Links a discord profile to the account that generated `args.token`. */
  async register(args: RegisterDiscordProfileDto) {
    const pending = this._consumeToken({ token: args.token });
    if (!pending) {
      this.logger.warn('Registration attempted with an unknown or expired token');
      return false;
    }
    const profile = { discordId: args.id, name: args.name, url: args.url, userEmail: pending.userEmail };
    const registered = await this.prisma.discord.upsert({
      where: { userEmail: pending.userEmail },
      create: profile,
      update: profile,
      include: { user: true },
    });
    await this._clearProfileCache({ discordId: args.id });
    this.logger.log(`Discord ${args.id} linked to ${pending.userEmail}`);
    return registered.user;
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
    const profile = await this._getDiscordProfileFromId({ discordId: args.discordId });
    if (!profile) return false;
    const battle = this.battleService.getUserBattle(profile.userEmail);
    if (!battle) return false;
    return battle.toJson();
  }

  private async _getDiscordProfileFromId(args: { discordId: string }): Promise<DiscordUser> {
    const cacheKey = this._profileCacheKey(args.discordId);
    const cachedDiscordUser = await this.cache.get<DiscordUser>(cacheKey);
    if (cachedDiscordUser) {
      this.cacheLogger.log(`returning cached ${cacheKey}`);
      return cachedDiscordUser;
    }
    const discordUser = await this.prisma.discord.findUnique({
      where: { discordId: args.discordId },
    });
    if (discordUser) {
      await this.cache.set(cacheKey, discordUser);
    }
    return discordUser;
  }

  private _clearProfileCache(args: { discordId: string }) {
    return this.cache.del(this._profileCacheKey(args.discordId));
  }

  private _profileCacheKey(discordId: string) {
    return `discord_user_${discordId}`;
  }

  /** Tokens are single use — looking one up also burns it. */
  private _consumeToken(args: { token: string }) {
    if (!args.token) return undefined;
    for (const [userEmail, pending] of this.registerTokens) {
      if (pending.token !== args.token) continue;
      this.registerTokens.delete(userEmail);
      return pending.expiresAt > Date.now() ? pending : undefined;
    }
    return undefined;
  }
}
