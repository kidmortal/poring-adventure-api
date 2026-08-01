import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { NotificationService } from 'src/integrations/notification/notification.service';
import { Utils } from 'src/utilities/utils';
import { GuildRepository } from './guild.repository';
import { GuildPermission, GuildPermissions } from './guild.permissions';
import { levelChange } from './guild.rules';

/** Accepting, contributing to and completing the guild's current task. */
@Injectable()
export class GuildTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: GuildRepository,
    private readonly permissions: GuildPermissions,
    private readonly websocket: WebsocketService,
    private readonly notificationService: NotificationService,
  ) {}

  findAllGuildTasks() {
    return this.repository.findAllGuildTasks();
  }

  async acceptTask(args: { userEmail: string; taskId: number }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_TASKS,
    });
    if (!member) return false;

    const currentTask = await this.repository.getCurrentTask({ guildId: member.guildId });
    if (currentTask) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'Your guild is already doing a task',
      });
      return false;
    }

    const newTask = await this.prisma.guildTask.findUnique({ where: { id: args.taskId } });
    if (!newTask) return false;

    await this.prisma.currentGuildTask.create({
      data: {
        guildId: member.guildId,
        guildTaskId: newTask.id,
        remainingKills: newTask.killCount,
      },
    });
    await this._refresh(member.guildId);
    return true;
  }

  async cancelCurrentTask(args: { userEmail: string }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_TASKS,
    });
    if (!member) return false;

    await this.prisma.currentGuildTask.delete({ where: { guildId: member.guildId } });
    await this._refresh(member.guildId);
    return true;
  }

  /** Pays out the task when its kill goal has been met. */
  async finishCurrentTask(args: { userEmail: string }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_TASKS,
    });
    if (!member) return false;

    await this.prisma.$transaction(async (tx) => {
      const currentTask = await this.repository.getCurrentTask({ guildId: member.guildId, tx });
      if (!currentTask || currentTask.remainingKills > 0) return;

      const { task, guildId } = currentTask;
      await this._addTaskPointsToGuild({ guildId, amount: task.taskPoints, tx });
      await tx.currentGuildTask.delete({ where: { guildId } });
      await this._distributeTokens({ guildId, amount: task.taskPoints, tx });

      await this._refresh(guildId);
      await this.notificationService.sendPushNotificationToTag({
        tagKey: 'guild',
        tagValue: String(guildId),
        title: 'Guild Task Completed',
        message: `${task.taskPoints} Task Points has been added to your account.`,
      });
    });
    return true;
  }

  /** Called by the battle loop whenever a member kills on the task's map. */
  async contributeToGuildTask(args: { userEmail: string; mapId: number; amount: number; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    const member = await this.repository.getUserGuildMember({ userEmail: args.userEmail, tx });
    if (!member) return false;

    const task = await this.repository.getCurrentTask({ guildId: member.guildId, tx });
    if (!task || task.remainingKills <= 0 || task.task.mapId !== args.mapId) return false;

    await tx.currentGuildTask.update({
      where: { id: task.id },
      data: { remainingKills: { decrement: args.amount } },
    });
    await tx.guildMember.update({
      where: { userEmail: args.userEmail },
      data: {
        contribution: { increment: args.amount },
        guildTokens: { increment: args.amount },
      },
    });
    await this._refresh(member.guildId);
    return true;
  }

  /** Task points double as guild experience, so the guild may level up or down. */
  private async _addTaskPointsToGuild(args: { guildId: number; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const guild = await tx.guild.findUnique({ where: { id: args.guildId } });
    const correctLevel = Utils.getLevelFromExp(guild.experience + args.amount);

    await tx.guild.update({
      where: { id: args.guildId },
      data: {
        taskPoints: { increment: args.amount },
        experience: { increment: args.amount },
        ...levelChange({ currentLevel: guild.level, correctLevel }),
      },
    });
    return true;
  }

  private async _distributeTokens(args: { guildId: number; amount: number; tx: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    const guild = await this.repository.getGuild({ guildId: args.guildId });
    if (!guild) return;

    for await (const member of guild.members) {
      await tx.guildMember.update({
        where: { id: member.id },
        data: { guildTokens: { increment: args.amount } },
      });
    }
  }

  private async _refresh(guildId: number) {
    await this.repository.clearGuildCache({ guildId });
    await this.repository.notifyGuildWithUpdate({ guildId });
  }
}
