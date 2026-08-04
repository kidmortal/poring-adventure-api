import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { PrismaService } from 'src/core/prisma/prisma.service';
import { TRANSACTION_OPTIONS } from 'src/core/prisma/types/prisma';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { ITEM_WITH_BUFF } from 'src/feature/items/entities/itemInclude';
import { UsersRepository } from 'src/feature/users/users.repository';

import { campRestore, entryBlockers, isRunStale, RUN_STATUS } from './dungeon.rules';

/** Bosses, in the order they are fought, each with what it drops. */
const DUNGEON_WITH_MONSTERS = {
  monsters: {
    orderBy: { stage: 'asc' as const },
    include: { drops: { include: { item: ITEM_WITH_BUFF } } },
  },
};

/**
 * Runs a party's attempt at a dungeon: who may walk in, which boss is next, and
 * what the run's outcome does to it. The fights themselves belong to the battle
 * service — this only ever hands it the boss it should stand up, the same split
 * the guild boss uses.
 */
@Injectable()
export class DungeonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly websocket: WebsocketService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly logger = new Logger('Dungeon');

  /** Every dungeon with its bosses and their loot. Content, so it is cached. */
  async findAll() {
    const cacheKey = 'dungeons';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const dungeons = await this.prisma.dungeon.findMany({
      orderBy: [{ sortOrder: 'asc' }, { recommendedLevel: 'asc' }],
      include: DUNGEON_WITH_MONSTERS,
    });
    await this.cache.set(cacheKey, dungeons);
    return dungeons;
  }

  /**
   * Everything the dungeon screen needs in one payload: the run the caller is
   * inside, and every entry held by the people they would walk in with. Both
   * are party-wide, because the entry is spent party-wide.
   */
  async getStatus(args: { userEmail: string }) {
    const emails = await this.partyEmails(args);
    await this.expireStaleRuns({ emails });

    const [run, entries] = await Promise.all([
      this.getActiveRun({ userEmail: args.userEmail }),
      this.prisma.dungeonEntry.findMany({
        where: { userEmail: { in: emails } },
        select: { userEmail: true, dungeonId: true, usedAt: true },
      }),
    ]);

    return { run, entries };
  }

  /** The run the player is currently inside, if any. */
  async getActiveRun(args: { userEmail: string }) {
    return this.prisma.dungeonRun.findFirst({
      where: { status: RUN_STATUS.active, members: { some: { userEmail: args.userEmail } } },
      orderBy: { id: 'desc' },
      include: {
        dungeon: { include: DUNGEON_WITH_MONSTERS },
        members: { include: { user: { select: { name: true, email: true, appearance: true } } } },
      },
    });
  }

  /** Pushes the dungeon screen's payload to one player. */
  async notifyUserWithStatus(args: { userEmail: string }) {
    const status = await this.getStatus(args);
    this.websocket.sendMessageToSocket({
      event: 'dungeon_status',
      email: args.userEmail,
      payload: status,
    });
    return true;
  }

  /** The same, to everyone the run belongs to — a run is never one player's. */
  async notifyRun(args: { emails: string[] }) {
    for await (const userEmail of args.emails) {
      await this.notifyUserWithStatus({ userEmail });
    }
  }

  /**
   * Everything that has to be true before a party walks in, resolved in one
   * place so the battle service only has to ask once. Returns the dungeon and
   * its first boss, or undefined with the reason already sent.
   */
  async prepareEntry(args: { userEmail: string; participants: { email: string; name: string }[]; dungeonId: number }) {
    const dungeon = await this.prisma.dungeon.findUnique({
      where: { id: args.dungeonId },
      include: DUNGEON_WITH_MONSTERS,
    });
    if (!dungeon) return this._denyUndefined(args.userEmail, 'No such dungeon');
    if (dungeon.monsters.length === 0) {
      return this._denyUndefined(args.userEmail, `There is nothing standing in ${dungeon.name}`);
    }

    const emails = args.participants.map((participant) => participant.email);
    // Before the standing-run check, so yesterday's abandoned run is not what
    // keeps the party out of today's.
    await this.expireStaleRuns({ emails });

    const standing = await this.prisma.dungeonRun.findFirst({
      where: { status: RUN_STATUS.active, members: { some: { userEmail: { in: emails } } } },
      include: { dungeon: { select: { name: true } }, members: { select: { userEmail: true } } },
    });
    if (standing) {
      const inside = standing.members.some((member) => member.userEmail === args.userEmail);
      const who = inside ? 'You are' : 'Someone in your party is';
      return this._denyUndefined(args.userEmail, `${who} already inside ${standing.dungeon.name}`);
    }

    const entries = await this.prisma.dungeonEntry.findMany({
      where: { dungeonId: dungeon.id, userEmail: { in: emails } },
    });
    const blockers = entryBlockers({ participants: args.participants, entries, now: new Date() });
    if (blockers.length > 0) {
      const blocker = blockers[0];
      const who = blocker.email === args.userEmail ? 'You have' : `${blocker.name} has`;
      return this._denyUndefined(args.userEmail, `${who} already run ${dungeon.name} today`);
    }

    return { dungeon, boss: dungeon.monsters[0], emails };
  }

  /**
   * Spends everyone's entry and opens the run. The entry goes before the first
   * blow, not after the last: an attempt is what the day buys, and a party that
   * wipes on the first boss has still had it.
   */
  async startRun(args: { dungeonId: number; leaderEmail: string; emails: string[] }) {
    const usedAt = new Date();

    const run = await this.prisma.$transaction(async (tx) => {
      for await (const userEmail of args.emails) {
        await tx.dungeonEntry.upsert({
          where: { userEmail_dungeonId: { userEmail, dungeonId: args.dungeonId } },
          create: { userEmail, dungeonId: args.dungeonId, usedAt },
          update: { usedAt },
        });
      }
      return tx.dungeonRun.create({
        data: {
          dungeonId: args.dungeonId,
          leaderEmail: args.leaderEmail,
          members: { create: args.emails.map((userEmail) => ({ userEmail })) },
        },
      });
    }, TRANSACTION_OPTIONS);

    this.logger.log(`run ${run.id} opened on dungeon ${args.dungeonId} by ${args.leaderEmail}`);
    await this.notifyRun({ emails: args.emails });
    return run;
  }

  /**
   * The boss the run has reached, and who is owed the fight. Undefined with the
   * reason already sent when there is nothing left to fight.
   */
  async prepareNextFight(args: { userEmail: string }) {
    const run = await this.getActiveRun({ userEmail: args.userEmail });
    if (!run) return this._denyUndefined(args.userEmail, 'You are not inside a dungeon');

    if (isRunStale(run, new Date())) {
      await this.failRun({ runId: run.id });
      return this._denyUndefined(args.userEmail, 'That run expired when the day rolled over');
    }

    const boss = run.dungeon.monsters.find((monster) => monster.stage === run.stage + 1);
    if (!boss) {
      // Nothing left standing but the run is still open: settle it rather than
      // leaving the party holding a run they cannot advance.
      await this.completeStage({ runId: run.id });
      return this._denyUndefined(args.userEmail, `${run.dungeon.name} is already cleared`);
    }

    return { run, boss, emails: run.members.map((member) => member.userEmail) };
  }

  /**
   * Banks a boss the party has just put down. The run closes itself on the
   * last one, which is what turns three separate battles into one clear.
   */
  async completeStage(args: { runId: number }) {
    const run = await this.prisma.dungeonRun.findUnique({
      where: { id: args.runId },
      include: { dungeon: { include: { monsters: { select: { id: true } } } }, members: true },
    });
    if (!run || run.status !== RUN_STATUS.active) return false;

    const stage = Math.min(run.stage + 1, run.dungeon.monsters.length);
    const cleared = stage >= run.dungeon.monsters.length;

    await this.prisma.dungeonRun.update({
      where: { id: run.id },
      data: {
        stage,
        status: cleared ? RUN_STATUS.cleared : RUN_STATUS.active,
        finishedAt: cleared ? new Date() : null,
      },
    });

    const emails = run.members.map((member) => member.userEmail);
    if (cleared) {
      this.logger.log(`run ${run.id} cleared ${run.dungeon.name}`);
      emails.forEach((email) => this.websocket.sendTextNotification({ email, text: `${run.dungeon.name} cleared` }));
    }
    await this.notifyRun({ emails });
    return true;
  }

  /**
   * Ends the attempt. A wipe and a retreat are the same thing here: the entry
   * was spent walking in, so the day is done either way.
   */
  async failRun(args: { runId: number }) {
    const run = await this.prisma.dungeonRun.findUnique({
      where: { id: args.runId },
      include: { members: true },
    });
    if (!run || run.status !== RUN_STATUS.active) return false;

    await this.prisma.dungeonRun.update({
      where: { id: run.id },
      data: { status: RUN_STATUS.failed, finishedAt: new Date() },
    });

    this.logger.log(`run ${run.id} failed`);
    await this.notifyRun({ emails: run.members.map((member) => member.userEmail) });
    return true;
  }

  /** Walking out between bosses. It costs the run, and the run is the entry. */
  async abandon(args: { userEmail: string }) {
    const run = await this.getActiveRun({ userEmail: args.userEmail });
    if (!run) return this._deny(args.userEmail, 'You are not inside a dungeon');

    await this.failRun({ runId: run.id });
    return true;
  }

  /**
   * The breather between bosses: everyone comes back up to a share of their
   * pools, which is the only way someone who fell on the last boss is at the
   * table for the next one. It never takes anything away — a party that came
   * through in better shape keeps it.
   */
  async campRestoreForRun(args: { emails: string[] }) {
    const stats = await this.prisma.stats.findMany({ where: { userEmail: { in: args.emails } } });

    for await (const row of stats) {
      const restored = campRestore(row);
      if (restored.health === row.health && restored.mana === row.mana) continue;

      await this.prisma.stats.update({
        where: { userEmail: row.userEmail },
        data: { health: restored.health, mana: restored.mana },
      });
      await this.usersRepository.clearUserCache({ email: row.userEmail });
    }
  }

  /**
   * Closes any run these players left standing on an earlier day. Entries come
   * back at midnight UTC, so a run that survived the boundary would be a second
   * attempt riding on the first day's progress.
   */
  async expireStaleRuns(args: { emails: string[] }) {
    const runs = await this.prisma.dungeonRun.findMany({
      where: { status: RUN_STATUS.active, members: { some: { userEmail: { in: args.emails } } } },
      select: { id: true, startedAt: true },
    });

    const now = new Date();
    for await (const run of runs) {
      if (isRunStale(run, now)) {
        await this.prisma.dungeonRun.update({
          where: { id: run.id },
          data: { status: RUN_STATUS.failed, finishedAt: now },
        });
      }
    }
  }

  /** Everyone who would walk in: the party, or the player standing alone. */
  private async partyEmails(args: { userEmail: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: args.userEmail },
      select: { partyId: true },
    });
    if (!user?.partyId) return [args.userEmail];

    const members = await this.prisma.user.findMany({
      where: { partyId: user.partyId },
      select: { email: true },
    });
    return members.map((member) => member.email);
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
