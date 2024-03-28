import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { WebsocketService } from 'src/websocket/websocket.service';

@Injectable()
export class GuildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async findAll() {
    const cacheKey = `guild_ranking`;
    const cachedRanking = await this.cache.get(cacheKey);
    if (cachedRanking) return cachedRanking as any;
    const guildRanking = await this.prisma.guild.findMany({
      take: 10,
      orderBy: { experience: 'desc' },
      include: { members: { include: { user: { include: { stats: true } } } } },
    });
    await this.cache.set(cacheKey, guildRanking);
    return guildRanking;
  }

  async getGuildFromUser(args: { userEmail: string }) {
    return this._notifyUserWithGuild(args);
  }

  private async _getGuild(args: { guildId: number }) {
    const cacheKey = `guild_id_${args.guildId}`;
    const cachedGuild = await this.cache.get(cacheKey);
    if (cachedGuild) return cachedGuild as any;
    const guild = await this.prisma.guild.findUnique({
      where: { id: args.guildId },
      include: {
        currentGuildTask: {
          include: { task: { include: { target: true } } },
        },
        members: {
          include: { user: { include: { stats: true, appearance: true } } },
          orderBy: { contribution: 'desc' },
        },
      },
    });
    await this.cache.set(cacheKey, guild);
    return guild;
  }
  private async _notifyUserWithGuild(args: { userEmail: string }) {
    const userGuild = await this.prisma.guildMember.findUnique({
      where: { userEmail: args.userEmail },
    });
    if (!userGuild) return false;
    const guild = await this._getGuild({ guildId: userGuild.guildId });
    if (!guild) return false;

    this.websocket.sendMessageToSocket({
      event: 'guild',
      email: args.userEmail,
      payload: guild,
    });
    return true;
  }
}
