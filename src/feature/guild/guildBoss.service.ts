import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext, TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { NotificationService } from 'src/integrations/notification/notification.service';
import { isNewDay } from 'src/feature/users/users.rules';
import { GuildRepository } from './guild.repository';
import { GuildPermission, GuildPermissions } from './guild.permissions';
import { GuildTaskService } from './guildTask.service';
import {
  GuildBossDifficulty,
  isGuildBossDifficulty,
  partyKeyFor,
  scaleBoss,
  shareDamageEvenly,
  splitTokensByDamage,
} from './guildBoss.rules';

/**
 * The guild boss: one standing monster per guild, summoned by an officer at a
 * difficulty of their choosing. Its health pool persists between fights, so the
 * guild wears it down over days — every member gets one entry per UTC day, and
 * what they do with it is banked as damage. The kill pays the guild in shards
 * and every member in tokens, proportional to the damage they banked.
 */
@Injectable()
export class GuildBossService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: GuildRepository,
    private readonly permissions: GuildPermissions,
    private readonly taskService: GuildTaskService,
    private readonly websocket: WebsocketService,
    private readonly notificationService: NotificationService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly logger = new Logger('Guild boss');

  async findAllBosses() {
    const cacheKey = 'guild_bosses';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const bosses = await this.prisma.guildBoss.findMany({ orderBy: { requiredGuildLevel: 'asc' } });
    await this.cache.set(cacheKey, bosses);
    return bosses;
  }

  /** The standing boss, carrying what its difficulty is actually worth on the kill. */
  async getCurrentBoss(args: { guildId: number; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    const standing = await tx.currentGuildBoss.findUnique({
      where: { guildId: args.guildId },
      include: { boss: true, damage: { include: { user: { include: { appearance: true } } } } },
    });
    if (!standing) return null;

    const scaled = scaleBoss(standing.boss, standing.difficulty as GuildBossDifficulty);
    return { ...standing, reward: { taskPoints: scaled.taskPoints, tokens: scaled.tokens } };
  }

  /** The boss the caller's guild has standing, pushed to them. */
  async notifyUserWithBoss(args: { userEmail: string }) {
    const member = await this.repository.getUserGuildMember(args);
    const boss = member?.guildId ? await this.getCurrentBoss({ guildId: member.guildId }) : undefined;

    this.websocket.sendMessageToSocket({
      event: 'guild_boss',
      email: args.userEmail,
      payload: boss ?? false,
    });
    return !!boss;
  }

  async summon(args: { userEmail: string; bossId: number; difficulty: string }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_BOSS,
    });
    if (!member) return false;

    if (!isGuildBossDifficulty(args.difficulty)) {
      return this._deny(args.userEmail, 'That is not a difficulty');
    }

    const standing = await this.getCurrentBoss({ guildId: member.guildId });
    if (standing) {
      return this._deny(args.userEmail, 'Your guild already has a boss standing');
    }

    const boss = await this.prisma.guildBoss.findUnique({ where: { id: args.bossId } });
    if (!boss) return this._deny(args.userEmail, 'No such boss');

    const guild = await this.prisma.guild.findUnique({ where: { id: member.guildId } });
    if (guild.level < boss.requiredGuildLevel) {
      return this._deny(args.userEmail, `${boss.name} needs a level ${boss.requiredGuildLevel} guild`);
    }

    const scaled = scaleBoss(boss, args.difficulty);
    await this.prisma.currentGuildBoss.create({
      data: {
        guildId: member.guildId,
        guildBossId: boss.id,
        difficulty: args.difficulty,
        maxHealth: scaled.health,
        health: scaled.health,
        attack: scaled.attack,
      },
    });

    await this._notifyGuild(member.guildId);
    await this.notificationService.sendPushNotificationToTag({
      tagKey: 'guild',
      tagValue: String(member.guildId),
      title: 'Guild Boss',
      message: `${boss.name} has been summoned on ${args.difficulty}.`,
    });
    return true;
  }

  /**
   * Sends the boss away with its health pool and everyone's banked damage. A
   * guild that has bitten off a nightmare it cannot chew would otherwise be
   * stuck with it forever.
   */
  async dismiss(args: { userEmail: string }) {
    const member = await this.permissions.requireMember({
      userEmail: args.userEmail,
      level: GuildPermission.MANAGE_BOSS,
    });
    if (!member) return false;

    const standing = await this.getCurrentBoss({ guildId: member.guildId });
    if (!standing) return this._deny(args.userEmail, 'Your guild has no boss standing');

    await this.prisma.currentGuildBoss.delete({ where: { id: standing.id } });
    await this._notifyGuild(member.guildId);
    return true;
  }

  /** Whether the member still has today's entry. */
  hasEntry(member: { bossEntryUsedAt?: Date | null }) {
    return isNewDay(member.bossEntryUsedAt ?? undefined, new Date());
  }

  /**
   * Everything that has to be true before a boss fight starts, resolved in one
   * place so the battle service only has to ask once. Returns the boss and the
   * party it will be fought by, or undefined with the reason already sent.
   */
  async prepareFight(args: { userEmail: string; partyEmails: string[] }) {
    const member = await this.repository.getUserGuildMember({ userEmail: args.userEmail });
    if (!member?.guildId) return this._denyUndefined(args.userEmail, 'You have no guild');

    const standing = await this.getCurrentBoss({ guildId: member.guildId });
    if (!standing || standing.health <= 0) {
      return this._denyUndefined(args.userEmail, 'Your guild has no boss standing');
    }

    // A guild boss is guild business: an outsider in the party blocks the fight
    // rather than quietly fighting without them.
    const members = await this.prisma.guildMember.findMany({
      where: { userEmail: { in: args.partyEmails } },
      // The name is what the party knows each other by — an email in a
      // notification tells the caller nothing.
      include: { user: { select: { name: true } } },
    });
    const outsider = args.partyEmails.find(
      (email) => !members.some((m) => m.userEmail === email && m.guildId === member.guildId),
    );
    if (outsider) {
      return this._denyUndefined(args.userEmail, 'Everyone in the party has to be in your guild');
    }

    // The entry is spent by the whole party, so one member out of entries stops
    // the fight for all of them.
    const spent = members.find((m) => !this.hasEntry(m));
    if (spent) {
      const who = spent.userEmail === args.userEmail ? 'You have' : `${spent.user?.name ?? spent.userEmail} has`;
      return this._denyUndefined(args.userEmail, `${who} already fought the boss today`);
    }

    return { boss: standing, guildId: member.guildId, emails: args.partyEmails };
  }

  /** Spends today's entry for everyone who is about to walk in. */
  async consumeEntries(args: { guildId: number; emails: string[] }) {
    await this.prisma.guildMember.updateMany({
      where: { userEmail: { in: args.emails } },
      data: { bossEntryUsedAt: new Date() },
    });
    // Entries are part of the cached guild payload, so it has to go.
    await this.repository.clearGuildCache({ guildId: args.guildId });
    await this.repository.notifyGuildWithUpdate({ guildId: args.guildId });
  }

  /**
   * Banks what a finished fight did to the boss. Called however the fight ended
   * — won, wiped or run from — so damage is never lost, and the payout fires
   * the moment the pool runs out.
   */
  async applyDamage(args: {
    guildId: number;
    damageByUser: { userEmail: string; damage: number }[];
    participants: string[];
    partyLeaderEmail?: string;
  }) {
    const total = args.damageByUser.reduce((sum, entry) => sum + entry.damage, 0);
    if (total <= 0) return false;

    const standing = await this.getCurrentBoss({ guildId: args.guildId });
    if (!standing) return false;

    // Damage past the last point does not bank — the pool is the ceiling.
    const capped = Math.min(total, standing.health);
    // The party fought as one, so it banks as one: the score is theirs together,
    // split evenly, whoever happened to land the hits.
    const banked = shareDamageEvenly(capped, args.participants);
    const partyKey = partyKeyFor(args.participants);
    const partyLeaderEmail = partyKey ? (args.partyLeaderEmail ?? null) : null;
    // What each of them actually hit for is kept beside the score, so the
    // ranking can show who carried the fight.
    const dealtBy = new Map(args.damageByUser.map((entry) => [entry.userEmail, entry.damage]));

    await this.prisma.$transaction(async (tx) => {
      for await (const { userEmail, damage } of banked) {
        const dealtDamage = dealtBy.get(userEmail) ?? 0;
        await tx.guildBossDamage.upsert({
          where: { currentGuildBossId_userEmail: { currentGuildBossId: standing.id, userEmail } },
          create: { currentGuildBossId: standing.id, userEmail, damage, dealtDamage, partyKey, partyLeaderEmail },
          update: {
            damage: { increment: damage },
            dealtDamage: { increment: dealtDamage },
            partyKey,
            partyLeaderEmail,
          },
        });
      }
      await tx.currentGuildBoss.update({
        where: { id: standing.id },
        data: { health: { decrement: capped } },
      });
    }, TRANSACTION_OPTIONS);

    const remaining = standing.health - capped;
    this.logger.debug(`${standing.boss.name} took ${capped}, ${remaining} left`);

    if (remaining <= 0) {
      await this._payout(standing.id);
    } else {
      await this._notifyGuild(args.guildId);
    }
    return true;
  }

  /** Shards to the guild, tokens to everyone by the damage they banked. */
  private async _payout(currentGuildBossId: number) {
    const standing = await this.prisma.currentGuildBoss.findUnique({
      where: { id: currentGuildBossId },
      include: { boss: true, damage: true },
    });
    if (!standing) return false;

    const reward = scaleBoss(standing.boss, standing.difficulty as GuildBossDifficulty);
    const shares = splitTokensByDamage(reward.tokens, standing.damage);

    await this.prisma.$transaction(async (tx) => {
      await this.taskService.addTaskPointsToGuild({
        guildId: standing.guildId,
        amount: reward.taskPoints,
        tx,
      });
      for await (const { userEmail, tokens } of shares) {
        await tx.guildMember.update({
          where: { userEmail },
          data: { guildTokens: { increment: tokens } },
        });
      }
      // The damage rows go with it, so the next boss starts everyone at zero.
      await tx.currentGuildBoss.delete({ where: { id: standing.id } });
    }, TRANSACTION_OPTIONS);

    this.logger.log(`${standing.boss.name} defeated by guild ${standing.guildId}`);
    await this._notifyGuild(standing.guildId);
    await this.notificationService.sendPushNotificationToTag({
      tagKey: 'guild',
      tagValue: String(standing.guildId),
      title: 'Guild Boss Defeated',
      message: `${standing.boss.name} is down. ${reward.taskPoints} soulshards for the guild.`,
    });

    shares.forEach(({ userEmail, tokens }) =>
      this.websocket.sendTextNotification({
        email: userEmail,
        text: `${standing.boss.name} defeated, you earned ${tokens} guild tokens`,
      }),
    );
    return true;
  }

  /** The boss rides its own event, so a fight in progress refreshes on its own. */
  private async _notifyGuild(guildId: number) {
    const boss = await this.getCurrentBoss({ guildId });
    const guild = await this.repository.getGuild({ guildId });

    guild?.members.forEach((member) =>
      this.websocket.sendMessageToSocket({
        event: 'guild_boss',
        email: member.userEmail,
        payload: boss ?? false,
      }),
    );
    await this.taskService.refreshGuild(guildId);
  }

  private _deny(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
    return false;
  }

  private _denyUndefined(email: string, text: string) {
    this.websocket.sendErrorNotification({ email, text });
    return undefined;
  }
}
