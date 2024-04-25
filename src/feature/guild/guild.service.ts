import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { Prisma } from '@prisma/client';
import { NotificationService } from 'src/services/notification/notification.service';
import { UsersService } from 'src/feature/users/users.service';
import { Utils } from 'src/utilities/utils';
import { ALLOWED_BLESSINGS, UPGRADE_FACTOR } from './constants';

type GuildWithMembers = Prisma.GuildGetPayload<{
  include: {
    blessing: true;
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
    private readonly notificationService: NotificationService,
    private readonly userService: UsersService,
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
    await this.prisma.$transaction(async (tx) => {
      const currentTask = await tx.currentGuildTask.findUnique({
        where: { guildId: guildMember.guildId },
        include: { task: true },
      });
      const task = currentTask.task;
      if (currentTask.remainingKills <= 0) {
        await this._addTaskPointsToGuild({ guildId: currentTask.guildId, amount: task.taskPoints, tx });
        await tx.currentGuildTask.delete({
          where: { guildId: currentTask.guildId },
        });
        await this._distributeTokensToGuild({
          guildId: currentTask.guildId,
          amount: task.taskPoints,
          tx,
        });
        this._clearGuildCache({ guildId: currentTask.guildId });
        this._notifyGuildWithUpdate({ guildId: currentTask.guildId });
        this.notificationService.sendPushNotificationToTag({
          tagKey: 'guild',
          tagValue: String(currentTask.guildId),
          title: 'Guild Task Completed',
          message: `${task.taskPoints} Task Points has been added to your account.`,
        });
      }
    });
  }

  async quitFromGuild(args: { userEmail: string }) {
    const guildMember = await this._getUserGuildMember(args);
    if (!guildMember) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `You have no guild`,
      });
      return false;
    }
    const role = guildMember.role as GuildRole;
    if (role === 'owner') {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `You cant leave the guild while you are the owner`,
      });
      return false;
    }
    await this._removeUserFromGuild({ userEmail: args.userEmail });
    return true;
  }

  async kickFromGuild(args: { userEmail: string; kickEmail: string }) {
    const guildMember = await this._getUserGuildMember(args);
    if (!guildMember) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `You have no guild`,
      });
      return false;
    }
    const kickMember = await this._getUserGuildMember({
      userEmail: args.kickEmail,
    });
    if (!kickMember) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Wrong user information to kick`,
      });
      return false;
    }
    if (guildMember.permissionLevel > kickMember.permissionLevel) {
      await this._removeUserFromGuild({ userEmail: args.kickEmail });
      return true;
    } else {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `You can't kick an user with higher role`,
      });
      return false;
    }
  }

  async applyToGuild(args: { userEmail: string; guildId: number }) {
    const currentApplication = await this.prisma.guildApplication.findFirst({
      where: args,
    });
    if (currentApplication) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `You've already applied to this guild`,
      });
      return false;
    }
    await this.prisma.guildApplication.create({ data: args });
    this._clearGuildCache({ guildId: args.guildId });
    this.websocket.sendTextNotification({
      email: args.userEmail,
      text: `Application sent to the guild`,
    });
    return true;
  }
  async acceptGuildApplication(args: { userEmail: string; applicationId: number }) {
    const requiredPermissionLevel = 1;
    const guildMember = await this._getUserGuildMember(args);
    if (guildMember.permissionLevel < requiredPermissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild permission isnt high enough (need ${requiredPermissionLevel}, have ${guildMember.permissionLevel})`,
      });
      return false;
    }
    await this.prisma.$transaction(async (tx) => {
      const application = await tx.guildApplication.findUnique({
        where: { id: args.applicationId },
        include: { guild: true },
      });
      if (application) {
        const applicantEmail = application.userEmail;
        const guildId = application.guildId;
        await tx.guildApplication.deleteMany({
          where: { userEmail: applicantEmail },
        });
        await tx.guildMember.create({
          data: { guildId, userEmail: applicantEmail },
        });
        this.notificationService.sendPushNotificationToUser({
          userEmail: applicantEmail,
          title: `Guild application`,
          message: `You have joined ${application.guild.name}`,
        });
        this.notificationService.addTagToSubscription({
          key: 'guild',
          value: String(guildMember.guildId),
          userEmail: applicantEmail,
        });
        this.userService.clearUserCache({ email: applicantEmail });
        this.userService.notifyUserUpdateWithProfile({ email: applicantEmail });
      }
    });

    this.websocket.sendTextNotification({
      email: args.userEmail,
      text: 'Application accepted',
    });
    this._clearGuildCache({ guildId: guildMember.guildId });
    this._notifyGuildWithUpdate({ guildId: guildMember.guildId });

    return true;
  }

  async refuseGuildApplication(args: { userEmail: string; applicationId: number }) {
    const requiredPermissionLevel = 1;
    const guildMember = await this._getUserGuildMember(args);
    if (guildMember.permissionLevel < requiredPermissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild permission isnt high enough (need ${requiredPermissionLevel}, have ${guildMember.permissionLevel})`,
      });
      return false;
    }
    await this.prisma.guildApplication.delete({
      where: { id: args.applicationId, guildId: guildMember.guildId },
    });

    this.websocket.sendTextNotification({
      email: args.userEmail,
      text: 'Application refused',
    });
    this._clearGuildCache({ guildId: guildMember.guildId });
    this._notifyGuildWithUpdate({ guildId: guildMember.guildId });
    return true;
  }

  async cancelCurrentTask(args: { userEmail: string }) {
    const requiredPermissionLevel = 1;
    const guildMember = await this._getUserGuildMember(args);
    if (guildMember.permissionLevel < requiredPermissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild permission isnt high enough (need ${requiredPermissionLevel}, have ${guildMember.permissionLevel})`,
      });
      return false;
    }

    await this.prisma.currentGuildTask.delete({
      where: { guildId: guildMember.guildId },
    });
    return true;
  }

  async acceptTask(args: { userEmail: string; taskId: number }) {
    const requiredPermissionLevel = 1;
    const guildMember = await this._getUserGuildMember(args);
    if (guildMember.permissionLevel < requiredPermissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild permission isnt high enough (need ${requiredPermissionLevel}, have ${guildMember.permissionLevel})`,
      });
      return false;
    }
    const currentTask = await this.prisma.currentGuildTask.findUnique({
      where: { guildId: guildMember.guildId },
    });
    if (currentTask) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild guild is already doing a task`,
      });

      return false;
    }
    const newTask = await this.prisma.guildTask.findUnique({
      where: { id: args.taskId },
    });
    if (newTask) {
      await this.prisma.currentGuildTask.create({
        data: {
          guildId: guildMember.guildId,
          guildTaskId: newTask.id,
          remainingKills: newTask.killCount,
        },
      });
      this._clearGuildCache({ guildId: guildMember.guildId });
      this._notifyGuildWithUpdate({ guildId: guildMember.guildId });
      return true;
    }
    return false;
  }

  async unlockGuildBlessings(args: { userEmail: string; guildId: number }) {
    const requiredPermissionLevel = 2;
    const guildMember = await this._getUserGuildMember(args);
    if (guildMember.permissionLevel < requiredPermissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild permission isnt high enough (need ${requiredPermissionLevel}, have ${guildMember.permissionLevel})`,
      });
      return false;
    }
    // verify is blessings are already unlocked
    const guild = await this._getGuild({ guildId: args.guildId });
    if (guild.blessing) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Blessings are already unlocked`,
      });
      return false;
    }
    await this.prisma.$transaction(async (tx) => {
      await this._decreaseGuildTokens({ guildId: args.guildId, amount: 100, tx });
      await tx.guild.update({
        where: { id: args.guildId },
        data: { blessing: { create: {} } },
      });
      this._clearGuildCache({ guildId: args.guildId });
      this._notifyGuildWithUpdate({ guildId: args.guildId });
      this.websocket.sendTextNotification({
        email: args.userEmail,
        text: `Blessings unlocked`,
      });
    });
    return true;
  }

  async upgradeGuildBlessing(args: { userEmail: string; guildId: number; blessing: string }) {
    const requiredPermissionLevel = 2;
    const guildMember = await this._getUserGuildMember(args);
    //verify if blessing is allowed
    if (!ALLOWED_BLESSINGS.includes(args.blessing)) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Blessing ${args.blessing} is not allowed`,
      });
      return false;
    }

    if (guildMember.permissionLevel < requiredPermissionLevel) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Your guild permission isnt high enough (need ${requiredPermissionLevel}, have ${guildMember.permissionLevel})`,
      });
      return false;
    }
    const guild = await this._getGuild({ guildId: args.guildId });
    if (!guild.blessing) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Blessings are not unlocked`,
      });
      return false;
    }
    const cost = 100;
    const incrementAmount = 1;
    const upgradeFactor = UPGRADE_FACTOR[args.blessing];
    const totalUpgrade = upgradeFactor * incrementAmount;
    await this.prisma.$transaction(async (tx) => {
      await this._decreaseGuildTokens({ guildId: args.guildId, amount: cost, tx });
      await tx.guild.update({
        where: { id: args.guildId },
        data: { blessing: { update: { [args.blessing]: { increment: totalUpgrade } } } },
      });
      await this._increaseGuildMemberStats({
        guildId: args.guildId,
        amount: totalUpgrade,
        stat: args.blessing,
        tx,
      });
      this._clearGuildCache({ guildId: args.guildId });
      this._notifyGuildWithUpdate({ guildId: args.guildId });
      this.websocket.sendTextNotification({
        email: args.userEmail,
        text: `Blessing ${args.blessing} upgraded`,
      });
    });
    return true;
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

  async contributeToGuildTask(args: { userEmail: string; mapId: number; amount: number; tx?: TransactionContext }) {
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

  private async _addTaskPointsToGuild(args: { guildId: number; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;

    const guild = await tx.guild.findUnique({ where: { id: args.guildId } });

    const currentExp = guild.experience;
    const finalExp = currentExp + args.amount;
    const currentLevel = guild.level;
    const correctLevel = Utils.getLevelFromExp(finalExp);
    if (correctLevel > currentLevel) {
      const levelDiff = correctLevel - currentLevel;
      await tx.guild.update({
        where: { id: args.guildId },
        data: {
          taskPoints: { increment: args.amount },
          experience: { increment: args.amount },
          level: { increment: levelDiff },
        },
      });
      return true;
    }
    if (currentLevel > correctLevel) {
      const levelDiff = currentLevel - correctLevel;
      await tx.guild.update({
        where: { id: args.guildId },
        data: {
          taskPoints: { increment: args.amount },
          experience: { increment: args.amount },
          level: { decrement: levelDiff },
        },
      });
      return true;
    }
    await tx.guild.update({
      where: { id: args.guildId },
      data: { experience: { increment: args.amount }, taskPoints: { increment: args.amount } },
    });
    return true;
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

  private async _getGuildCurrentTask(args: { guildId: number; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    const task = await tx.currentGuildTask.findUnique({
      where: { guildId: args.guildId },
      include: { task: true },
    });
    return task;
  }

  private async _getUserGuildMember(args: { userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    return tx.guildMember.findUnique({
      where: { userEmail: args.userEmail },
    });
  }

  private async _removeUserFromGuild(args: { userEmail: string }) {
    const data = await this.prisma.guildMember.delete({
      where: { userEmail: args.userEmail },
      include: { guild: true },
    });
    this.userService.clearUserCache({ email: args.userEmail });
    this._clearGuildCache({ guildId: data.guildId });
    this.userService.notifyUserUpdateWithProfile({
      email: args.userEmail,
    });
    this._notifyGuildWithUpdate({ guildId: data.guildId });
    this._notifyUserWithGuild(args);
    this.notificationService.sendPushNotificationToUser({
      userEmail: args.userEmail,
      title: 'Guild',
      message: `You have left from ${data.guild.name}`,
    });
    this.notificationService.removeTagFromSubscription({
      userEmail: args.userEmail,
      key: 'guild',
    });
  }

  private async _getGuild(args: { guildId: number }): Promise<GuildWithMembers> {
    const cacheKey = `guild_id_${args.guildId}`;
    const cachedGuild = await this.cache.get(cacheKey);
    if (cachedGuild) return cachedGuild as any;
    const guild = await this.prisma.guild.findUnique({
      where: { id: args.guildId },
      include: {
        currentGuildTask: { include: { task: { include: { target: true } } } },
        members: {
          include: { user: { include: { stats: true, appearance: true } } },
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
  private async _notifyUserWithGuild(args: { userEmail: string }) {
    const userGuildMember = await this.prisma.guildMember.findUnique({
      where: { userEmail: args.userEmail },
    });
    if (!userGuildMember) {
      this.websocket.sendMessageToSocket({
        event: 'guild',
        email: args.userEmail,
        payload: false,
      });
      return false;
    }
    const guild = await this._getGuild({ guildId: userGuildMember.guildId });
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

  private async _distributeTokensToGuild(args: { guildId: number; amount: number; tx: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    const guild = await this._getGuild(args);
    if (guild) {
      for await (const member of guild.members) {
        await tx.guildMember.update({
          where: { id: member.id },
          data: { guildTokens: { increment: args.amount } },
        });
      }
    }
  }
  private async _clearGuildCache(args: { guildId: number }) {
    const cacheKey = `guild_id_${args.guildId}`;
    this.cache.del(cacheKey);
  }
  private async _decreaseGuildTokens(args: { guildId: number; amount: number; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    // verify if has enough to decrement
    const guild = await tx.guild.findUnique({
      where: { id: args.guildId },
    });
    if (guild.taskPoints < args.amount) return false;
    await tx.guild.update({
      where: { id: args.guildId },
      data: { taskPoints: { decrement: args.amount } },
    });
    return true;
  }
  private async _increaseGuildMemberStats(args: {
    guildId: number;
    amount: number;
    stat: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    const guild = await this._getGuild({ guildId: args.guildId });
    if (guild) {
      for await (const member of guild.members) {
        await this.userService.increaseUserStats({
          userEmail: member.userEmail,
          [args.stat]: args.amount,
          tx,
        });
      }
    }
  }
  private async _decreaseGuildMemberStats(args: {
    guildId: number;
    amount: number;
    stat: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx ?? this.prisma;
    const guild = await this._getGuild({ guildId: args.guildId });
    if (guild) {
      for await (const member of guild.members) {
        await this.userService.decreaseUserStats({
          userEmail: member.userEmail,
          [args.stat]: args.amount,
          tx,
        });
      }
    }
  }
}
