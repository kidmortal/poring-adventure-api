import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { ALLOWED_BLESSINGS, UPGRADE_FACTOR } from './constants';
import { GuildRepository } from './guild.repository';
import { GuildPermission, GuildPermissions } from './guild.permissions';

const BLESSING_UNLOCK_COST = 100;
const BLESSING_UPGRADE_COST = 100;

/** Guild blessings: a shared stat bonus every member receives. */
@Injectable()
export class GuildBlessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: GuildRepository,
    private readonly permissions: GuildPermissions,
    private readonly websocket: WebsocketService,
    private readonly userStats: UserStatsService,
  ) {}

  async unlockGuildBlessings(args: { userEmail: string; guildId: number }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_BLESSINGS,
    });
    if (!member) return false;

    const guild = await this.repository.getGuild({ guildId: args.guildId });
    if (guild.blessing) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'Blessings are already unlocked',
      });
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await this._spendTokens({ guildId: args.guildId, amount: BLESSING_UNLOCK_COST, tx });
      await tx.guild.update({
        where: { id: args.guildId },
        data: { blessing: { create: {} } },
      });
    });

    await this._refresh(args.guildId);
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Blessings unlocked' });
    return true;
  }

  async upgradeGuildBlessing(args: { userEmail: string; guildId: number; blessing: string }) {
    if (!ALLOWED_BLESSINGS.includes(args.blessing)) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: `Blessing ${args.blessing} is not allowed`,
      });
      return false;
    }

    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_BLESSINGS,
    });
    if (!member) return false;

    const guild = await this.repository.getGuild({ guildId: args.guildId });
    if (!guild.blessing) {
      this.websocket.sendErrorNotification({
        email: args.userEmail,
        text: 'Blessings are not unlocked',
      });
      return false;
    }

    const upgradeAmount = UPGRADE_FACTOR[args.blessing];
    await this.prisma.$transaction(async (tx) => {
      await this._spendTokens({ guildId: args.guildId, amount: BLESSING_UPGRADE_COST, tx });
      await tx.guild.update({
        where: { id: args.guildId },
        data: { blessing: { update: { [args.blessing]: { increment: upgradeAmount } } } },
      });
      await this._applyToMembers({
        guildId: args.guildId,
        stat: args.blessing,
        amount: upgradeAmount,
        tx,
      });
    });

    await this._refresh(args.guildId);
    this.websocket.sendTextNotification({
      email: args.userEmail,
      text: `Blessing ${args.blessing} upgraded`,
    });
    return true;
  }

  /** A blessing applies to every current member's stat sheet. */
  private async _applyToMembers(args: { guildId: number; stat: string; amount: number; tx?: TransactionContext }) {
    const guild = await this.repository.getGuild({ guildId: args.guildId });
    if (!guild) return;

    for await (const member of guild.members) {
      await this.userStats.increaseUserStats({
        userEmail: member.userEmail,
        [args.stat]: args.amount,
        tx: args.tx,
      });
    }
  }

  private async _spendTokens(args: { guildId: number; amount: number; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    const guild = await tx.guild.findUnique({ where: { id: args.guildId } });
    if (guild.taskPoints < args.amount) return false;

    await tx.guild.update({
      where: { id: args.guildId },
      data: { taskPoints: { decrement: args.amount } },
    });
    return true;
  }

  private async _refresh(guildId: number) {
    await this.repository.clearGuildCache({ guildId });
    await this.repository.notifyGuildWithUpdate({ guildId });
  }
}
