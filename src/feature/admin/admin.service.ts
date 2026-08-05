import { UsersRepository } from 'src/feature/users/users.repository';
import { UserStatsService } from 'src/feature/users/userStats.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Buff, Debuff } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { MailService } from 'src/feature/mail/mail.service';
import { NotificationService } from 'src/integrations/notification/notification.service';
import { UsersService } from 'src/feature/users/users.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { UserWalletService } from 'src/feature/users/userWallet.service';
import { GuildRepository } from 'src/feature/guild/guild.repository';
import { BattleService } from 'src/feature/battle/battle.service';
import { BattleDebugAction } from 'src/feature/battle/battle';
import * as os from 'os';
import { execSync } from 'child_process';
import { memoryUsage } from 'process';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userStats: UserStatsService,
    private readonly notification: NotificationService,
    private readonly websocket: WebsocketService,
    private readonly userService: UsersService,
    private readonly mailService: MailService,
    private readonly userWallet: UserWalletService,
    private readonly guildRepository: GuildRepository,
    private readonly battleService: BattleService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async sendPushNotification(args: { message: string }) {
    await this.notification.sendPushNotification(args);
    return true;
  }
  async sendPushNotificationToUser(args: { userEmail: string; receiverEmail: string; message: string }) {
    await this.notification.sendPushNotificationToUser({
      title: 'Debug Message',
      message: args.message,
      userEmail: args.receiverEmail,
    });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'Push notification sent to user' });
    return true;
  }

  async disconnectUserSocket(args: { userEmail: string; disconnectEmail: string }) {
    this.websocket.breakUserConnection(args.disconnectEmail);
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'You have disconnected a user' });
    return true;
  }

  async getConnectedUsers(args: { userEmail: string }) {
    await this._notifyWithConnectedUsers(args);
    return true;
  }

  async sendGiftMail(args: { userEmail: string; receiverEmail: string }) {
    await this.mailService.sendMail({
      senderName: 'Admin',
      receiverEmail: args.receiverEmail,
      content: 'System Gift',
      silver: 100,
    });
    await this.mailService._notifyUserMailBox(args);
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'You have sent a gift to the user' });
    return true;
  }

  async clearCache() {
    await this.cache.reset();
    return true;
  }

  /**
   * Daily resources are handed out lazily, keyed on the date they were last
   * given — so putting them back is a matter of filling the bar and stamping it
   * with today, not waiting for midnight.
   */
  async resetDailyStamina(args: { userEmail: string; targetEmail?: string }) {
    const where = args.targetEmail ? { userEmail: args.targetEmail } : {};
    const stats = await this.prisma.stats.findMany({ where });

    for await (const stat of stats) {
      await this.prisma.stats.update({
        where: { userEmail: stat.userEmail },
        data: { stamina: stat.maxStamina, staminaRefilledAt: new Date() },
      });
      await this.usersRepository.clearUserCache({ email: stat.userEmail });
      await this.userService.notifyUserUpdateWithProfile({ email: stat.userEmail });
    }

    return this._report(args.userEmail, `Stamina refilled for ${stats.length} character(s)`);
  }

  /** Hands back today's guild boss entry, for one member or for everyone. */
  async resetBossEntry(args: { userEmail: string; targetEmail?: string }) {
    const where = args.targetEmail ? { userEmail: args.targetEmail } : {};
    const result = await this.prisma.guildMember.updateMany({ where, data: { bossEntryUsedAt: null } });

    // The entry rides on the cached guild payload, so every guild touched has
    // to be re-read before anyone sees it come back.
    const guilds = await this.prisma.guild.findMany({ select: { id: true } });
    for await (const guild of guilds) {
      await this.guildRepository.clearGuildCache({ guildId: guild.id });
      await this.guildRepository.notifyGuildWithUpdate({ guildId: guild.id });
    }

    return this._report(args.userEmail, `Boss entry restored for ${result.count} member(s)`);
  }

  /** Sends the guild's standing boss away, pool and banked damage with it. */
  async clearGuildBosses(args: { userEmail: string }) {
    const removed = await this.prisma.currentGuildBoss.deleteMany({});

    const guilds = await this.prisma.guild.findMany({ select: { id: true } });
    for await (const guild of guilds) {
      await this.guildRepository.clearGuildCache({ guildId: guild.id });
      await this.guildRepository.notifyGuildWithUpdate({ guildId: guild.id });
    }

    return this._report(args.userEmail, `Dismissed ${removed.count} guild boss(es)`);
  }

  async giveSilver(args: { userEmail: string; receiverEmail: string; amount: number }) {
    await this.userWallet.addSilverToUser({ userEmail: args.receiverEmail, amount: args.amount });
    await this.userService.notifyUserUpdateWithProfile({ email: args.receiverEmail });
    this.websocket.sendTextNotification({ email: args.receiverEmail, text: `An admin gave you ${args.amount} silver` });
    return this._report(args.userEmail, `Gave ${args.amount} silver`);
  }

  /**
   * Drops whatever fight the user is stuck in. A battle only lives in memory,
   * so a crash mid-fight can leave one nobody is able to end.
   */
  async forceEndBattle(args: { userEmail: string; targetEmail: string }) {
    const battle = this.battleService.getUserBattle(args.targetEmail);
    if (!battle) return this._report(args.userEmail, 'That user is not in a battle');

    await battle.removeBattle();
    battle.notifyBattleRemoved();
    return this._report(args.userEmail, 'Battle ended');
  }

  /**
   * Kills whatever the target is fighting, and pays the fight out as a win.
   *
   * The point is reaching what a kill leads to — a drop table, a level, the next
   * dungeon stage — without playing the fight first, so it settles through the
   * battle's own victory path rather than shortcutting to the rewards. With no
   * target it kills the admin's own fight, which is what it is used for.
   */
  async killBattleMonsters(args: { userEmail: string; targetEmail?: string }) {
    const targetEmail = args.targetEmail || args.userEmail;
    const battle = this.battleService.getUserBattle(targetEmail);
    if (!battle) return this._report(args.userEmail, 'That user is not in a battle');

    const killed = await battle.forceKillMonsters({ by: 'an admin', credit: targetEmail });
    if (!killed) return this._report(args.userEmail, 'That battle is already settled');

    return this._report(args.userEmail, 'Monsters killed');
  }

  /**
   * The debug panel's battle controls: heal or wound either side, hand out a
   * buff or a debuff, empty a mana pool, pass the turn, enrage the monster.
   *
   * The catalogue rows are read here and handed to the engine, which has no
   * database of its own — the rule that keeps the fight unit-testable. A named
   * buff or debuff that is not seeded is refused rather than silently skipped,
   * because a debug tool that does nothing and says nothing is worse than none.
   */
  async runBattleDebugAction(args: {
    userEmail: string;
    action: BattleDebugAction;
    targetEmail?: string;
    /** Buff or debuff to apply, by name. Only read by the actions that need one. */
    name?: string;
    amount?: number;
  }) {
    const targetEmail = args.targetEmail || args.userEmail;
    const battle = this.battleService.getUserBattle(targetEmail);
    if (!battle) return this._report(args.userEmail, 'That user is not in a battle');

    let buff: Buff | undefined;
    let debuff: Debuff | undefined;

    if (args.action === 'buff_allies') {
      buff = args.name
        ? await this.prisma.buff.findUnique({ where: { name: args.name } })
        : await this.prisma.buff.findFirst();
      if (!buff) return this._report(args.userEmail, `No buff named ${args.name}`);
    }

    if (args.action === 'debuff_monsters') {
      debuff = args.name
        ? await this.prisma.debuff.findUnique({ where: { name: args.name } })
        : await this.prisma.debuff.findFirst();
      if (!debuff) return this._report(args.userEmail, `No debuff named ${args.name}`);
    }

    const ran = await battle.runDebugAction({ action: args.action, by: 'an admin', buff, debuff, amount: args.amount });
    if (!ran) return this._report(args.userEmail, 'That battle is already settled');

    // The party's rows are only written when a fight ends, so a healed player
    // still reads their old health off their profile until this pushes it.
    for await (const email of battle.participantEmails) {
      await this.userService.notifyUserUpdateWithProfile({ email });
    }

    return this._report(args.userEmail, `Battle: ${args.action.replace(/_/g, ' ')}`);
  }

  /**
   * Puts a character's level back where their experience says it belongs, and
   * gives back the stat blocks the wrong levels took with them.
   *
   * The repair for the stale-snapshot bug in `levelUpUser`: every bad move was
   * one level's worth of the class block, so restoring the level difference
   * restores exactly what was lost — and nothing else, which is why this does
   * not recompute the stats outright. Equipment and guild blessings are written
   * into the same row, and a recompute would quietly delete them.
   */
  async resyncLevels(args: { userEmail: string; targetEmail?: string }) {
    const where = args.targetEmail ? { userEmail: args.targetEmail } : {};
    const stats = await this.prisma.stats.findMany({ where });

    let repaired = 0;
    for await (const stat of stats) {
      const moved = await this.userStats.levelUpUser({ userEmail: stat.userEmail });
      if (!moved) continue;
      repaired += 1;
      await this.usersRepository.clearUserCache({ email: stat.userEmail });
      await this.userService.notifyUserUpdateWithProfile({ email: stat.userEmail });
    }

    return this._report(args.userEmail, `Levels resynced: ${repaired} character(s) corrected`);
  }

  /** Forces the next read of a user to come from the database. */
  async clearUserCache(args: { userEmail: string; targetEmail: string }) {
    await this.usersRepository.clearUserCache({ email: args.targetEmail });
    await this.userService.notifyUserUpdateWithProfile({ email: args.targetEmail });
    return this._report(args.userEmail, 'Cache cleared and profile pushed');
  }

  private _report(email: string, text: string) {
    this.websocket.sendTextNotification({ email, text });
    return true;
  }

  async getServerInfo(args: { userEmail: string }) {
    const branchData = execSync('git rev-parse HEAD').toString();
    const branchHash = branchData.trim();
    const memoryInfo = this._getRamUsage();
    this.websocket.sendMessageToSocket({
      email: args.userEmail,
      event: 'server_info',
      payload: { branchHash, memoryInfo },
    });
    return true;
  }

  async restartServer() {
    execSync('pm2 restart poring-adventure');
    return true;
  }

  async fullHealUser(args: { userEmail: string; healEmail: string }) {
    await this.userStats.incrementUserHealth({ userEmail: args.healEmail, amount: 9999 });
    await this.userStats.incrementUserMana({ userEmail: args.healEmail, amount: 9999 });
    this.userService.notifyUserUpdateWithProfile({ email: args.healEmail });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'User has been Fully healed' });
    this.websocket.sendTextNotification({ email: args.healEmail, text: 'You got fully healed by an Admin' });
    this._notifyWithConnectedUsers(args);

    return true;
  }

  async killUser(args: { userEmail: string; killEmail: string }) {
    await this.userStats.decrementUserHealth({ userEmail: args.killEmail, amount: 9999 });
    await this.userStats.decrementUserMana({ userEmail: args.killEmail, amount: 9999 });
    this.userService.notifyUserUpdateWithProfile({ email: args.killEmail });
    this.websocket.sendTextNotification({ email: args.userEmail, text: 'User has been killed' });
    this.websocket.sendTextNotification({ email: args.killEmail, text: 'You got killed by an Admin' });
    this._notifyWithConnectedUsers(args);
    return true;
  }

  _getRamUsage() {
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const appMemoryUsage = memoryUsage().rss;
    const totalMemoryUsage = totalMemory - freeMemory;
    return {
      totalMemory,
      appMemoryUsage,
      totalMemoryUsage,
    };
  }

  async _notifyWithConnectedUsers(args: { userEmail: string }) {
    const sockets = this.websocket.getAllSockets();
    const users = {};
    const integrations = [];

    for await (const socket of sockets) {
      const email = socket.email;
      if (!users[email] && email) {
        if (email != 'discord') {
          const user = await this.usersRepository.getFullUser({
            userEmail: socket.email,
          });
          users[email] = user;
        } else {
          integrations.push('discord');
        }
      }
    }
    this.websocket.sendMessageToSocket({
      email: args.userEmail,
      event: 'connected_users',
      payload: {
        users: Object.values(users),
        connectedSockets: sockets.length,
        integrations,
      },
    });
    return true;
  }
}
