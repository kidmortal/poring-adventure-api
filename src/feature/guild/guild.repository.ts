import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';

export type GuildWithMembers = Prisma.GuildGetPayload<{
  include: {
    blessing: true;
    currentGuildTask: { include: { task: { include: { target: true } } } };
    members: {
      include: { user: { include: { stats: true; appearance: true; class: true } } };
    };
  };
}>;

/**
 * Cached guild reads plus the guild-wide socket pushes. Every guild service
 * goes through here, so cache keys and the `guild` event live in one place.
 */
@Injectable()
export class GuildRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly logger = new Logger('Cache - guild');

  async getGuild(args: { guildId: number }): Promise<GuildWithMembers> {
    const cacheKey = this._guildKey(args.guildId);
    const cached = await this.cache.get<GuildWithMembers>(cacheKey);
    if (cached) return cached;

    const guild = await this.prisma.guild.findUnique({
      where: { id: args.guildId },
      include: {
        currentGuildTask: { include: { task: { include: { target: true } } } },
        members: {
          // Class comes along so the member modal can name what they play.
          include: { user: { include: { stats: true, appearance: true, class: true } } },
          orderBy: { contribution: 'desc' },
        },
        guildApplications: {
          include: { user: { include: { appearance: true, stats: true } } },
        },
        blessing: true,
      },
    });
    await this.cache.set(cacheKey, guild);
    return guild;
  }

  getUserGuildMember(args: { userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    return tx.guildMember.findUnique({ where: { userEmail: args.userEmail } });
  }

  getCurrentTask(args: { guildId: number; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    return tx.currentGuildTask.findUnique({
      where: { guildId: args.guildId },
      include: { task: true },
    });
  }

  async findAllGuildTasks() {
    const cacheKey = 'guild_tasks';
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cached;
    }
    const guildTasks = await this.prisma.guildTask.findMany({ include: { target: true } });
    await this.cache.set(cacheKey, guildTasks);
    return guildTasks;
  }

  async findRanking() {
    const cacheKey = 'guild_ranking';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Carries what the guild profile shows — blessings, the running task and
    // each member's class — so opening one from the ranking costs no request.
    const guildRanking = await this.prisma.guild.findMany({
      take: 10,
      orderBy: { experience: 'desc' },
      include: {
        blessing: true,
        currentGuildTask: { include: { task: { include: { target: true } } } },
        members: { include: { user: { include: { stats: true, class: true, appearance: true } } } },
      },
    });
    await this.cache.set(cacheKey, guildRanking);
    return guildRanking;
  }

  clearGuildCache(args: { guildId: number }) {
    return this.cache.del(this._guildKey(args.guildId));
  }

  /** Pushes the guild to every one of its members. */
  async notifyGuildWithUpdate(args: { guildId: number }) {
    const guild = await this.getGuild(args);
    if (!guild) return false;

    guild.members.forEach((member) =>
      this.websocket.sendMessageToSocket({
        event: 'guild',
        email: member.userEmail,
        payload: guild,
      }),
    );
    return true;
  }

  /** Pushes the user's own guild to them, or `false` when they have none. */
  async notifyUserWithGuild(args: { userEmail: string }) {
    const member = await this.getUserGuildMember(args);
    const guild = member ? await this.getGuild({ guildId: member.guildId }) : undefined;

    this.websocket.sendMessageToSocket({
      event: 'guild',
      email: args.userEmail,
      payload: guild ?? false,
    });
    return !!guild;
  }

  private _guildKey(guildId: number) {
    return `guild_id_${guildId}`;
  }
}
