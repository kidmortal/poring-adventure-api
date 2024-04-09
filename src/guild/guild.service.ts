import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { WebsocketService } from 'src/websocket/websocket.service';
import { TransactionContext } from 'src/prisma/types/prisma';
import { Prisma } from '@prisma/client';

type GuildWithMembers = Prisma.GuildGetPayload<{
  include: {
    currentGuildTask: { include: { task: { include: { target: true } } } };
    members: {
      include: { user: { include: { stats: true; appearance: true } } };
    };
  };
}>;

@Injectable()
export class GuildService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}
  private logger = new Logger('Cache - guild');

  async finishCurrentTask(args: { userEmail: string }) {
    const requiredPermissionLevel = 1;
    const guildMember = await this._getUserGuildMember(args);
    if (guildMember.permissionLevel < requiredPermissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild permission isnt high enough (need ${requiredPermissionLevel}, have ${guildMember.permissionLevel})`,
      });
      return false;
    }
  }

  async findAllGuidTasks() {
    const cacheKey = `guild_tasks`;
    const cachedGuildTasks = await this.cache.get(cacheKey);
    if (cachedGuildTasks) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cachedGuildTasks as any;
    }
    const guildTasks = await this.prisma.guildTask.findMany({
      include: { target: true },
    });
    await this.cache.set(cacheKey, guildTasks);
    return guildTasks;
  }

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

  async contributeToGuildTask(args: {
    userEmail: string;
    mapId: number;
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    const member = await this._getUserGuildMember({
      userEmail: args.userEmail,
      tx,
    });
    if (!member) return false;
    const task = await this._getGuildCurrentTask({
      guildId: member.guildId,
      tx,
    });
    if (!task) return false;
    if (task.remainingKills <= 0) return;
    if (task.task.mapId === args.mapId) {
      await this._contributeToGuildTask({
        amount: args.amount,
        taskId: task.id,
        userEmail: args.userEmail,
        tx,
      });
      this.cache.del(`guild_id_${member.guildId}`);
      this._notifyGuildWithUpdate({ guildId: member.guildId });
    }
  }

  private async _contributeToGuildTask(args: {
    taskId: number;
    amount: number;
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    await tx.currentGuildTask.update({
      where: { id: args.taskId },
      data: { remainingKills: { decrement: args.amount } },
    });
    await tx.guildMember.update({
      where: { userEmail: args.userEmail },
      data: {
        contribution: { increment: args.amount },
        guildTokens: { increment: args.amount },
      },
    });
  }

  private async _getGuildCurrentTask(args: {
    guildId: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    const task = await tx.currentGuildTask.findUnique({
      where: { guildId: args.guildId },
      include: { task: true },
    });
    return task;
  }

  private async _getUserGuildMember(args: {
    userEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    return tx.guildMember.findUnique({
      where: { userEmail: args.userEmail },
    });
  }

  private async _getGuild(args: {
    guildId: number;
  }): Promise<GuildWithMembers> {
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

  private async _notifyGuildWithUpdate(args: { guildId: number }) {
    const guild = await this._getGuild(args);
    if (guild) {
      guild.members.forEach((member) => {
        this.websocket.sendMessageToSocket({
          event: 'guild',
          email: member.userEmail,
          payload: guild,
        });
      });
    }
  }
}
