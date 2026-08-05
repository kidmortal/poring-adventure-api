import { Injectable } from '@nestjs/common';
import { Buff } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { Utils } from 'src/utilities/utils';
import { UsersRepository } from './users.repository';
import { StatChanges, clampVital, statDelta } from './users.rules';

/** Health, mana, stats, levels and buffs — everything that lives on the Stats row. */
@Injectable()
export class UserStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: UsersRepository,
  ) {}

  async updateUserHealthMana(args: { userEmail: string; health: number; mana: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: { health: args.health, mana: args.mana },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  incrementUserHealth(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._adjustVital({ ...args, vital: 'health', amount: args.amount });
  }

  decrementUserHealth(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._adjustVital({ ...args, vital: 'health', amount: -args.amount });
  }

  incrementUserMana(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._adjustVital({ ...args, vital: 'mana', amount: args.amount });
  }

  decrementUserMana(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._adjustVital({ ...args, vital: 'mana', amount: -args.amount });
  }

  increaseUserStats(args: StatChanges & { userEmail: string; tx?: TransactionContext }) {
    return this._applyStats(args, 'increment');
  }

  decreaseUserStats(args: StatChanges & { userEmail: string; tx?: TransactionContext }) {
    return this._applyStats(args, 'decrement');
  }

  /**
   * Raises the daily stamina ceiling by something other than a profession level
   * — today only the guild stamina blessing.
   *
   * The gain is banked in `bonusMaxStamina` as well as in the ceiling itself,
   * because levelling a trade recomputes maxStamina from that trade's level and
   * would otherwise quietly wipe what the guild paid for. Only the ceiling
   * moves: the day's remaining bar is left where it is, the same way levelling
   * a profession refuses to hand out a free refill.
   */
  async raiseMaxStamina(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: {
        maxStamina: { increment: args.amount },
        bonusMaxStamina: { increment: args.amount },
      },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  increaseUserLevel(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._applyLevels({ ...args, direction: 'increment' });
  }

  decreaseUserLevel(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._applyLevels({ ...args, direction: 'decrement' });
  }

  /**
   * Brings the user's level in line with their experience, in either direction.
   *
   * **Both numbers are read from the row, never from a copy of it.** This used
   * to take the caller's in-memory user — which, for a party member, is a
   * snapshot out of the party cache that reward writes never invalidate. The
   * experience on that snapshot stops moving while the row's keeps climbing, so
   * every fight re-derived the same "you just levelled" from the same stale
   * basis and incremented again; when the cache finally refreshed, the row's
   * inflated level was suddenly far above what its experience justified and the
   * correction came back as one enormous decrement. A few of those and a level
   * one Priest is level -6 with the health to match.
   *
   * Reading the row makes the correction idempotent: run it a thousand times
   * and the second run has nothing to do.
   *
   * The exp gain is not passed in either — the caller credits it in the same
   * transaction, so by the time this reads the row it is already there.
   */
  async levelUpUser(args: { userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const stats = await tx.stats.findUnique({ where: { userEmail: args.userEmail } });
    if (!stats) return false;

    const currentLevel = stats.level;
    const correctLevel = Utils.getLevelFromExp(stats.experience);
    if (correctLevel === currentLevel) return false;

    await this._applyLevels({
      userEmail: args.userEmail,
      amount: Math.abs(correctLevel - currentLevel),
      direction: correctLevel > currentLevel ? 'increment' : 'decrement',
      tx: args.tx,
    });
    return true;
  }

  /**
   * Grants a buff, or extends one the user already has.
   *
   * Duration is capped at the buff's own `maxStack` multiple of its base, so a
   * cook cannot hand someone a hundred battles of +10% attack in one sitting —
   * food has to be eaten as it is needed, which is the whole reason the demand
   * for it regenerates.
   */
  async applyBuff(args: { userEmail: string; buff: Buff; duration: number; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    const ceiling = args.buff.duration * Math.max(args.buff.maxStack, 1);

    const existing = await tx.userBuff.findUnique({
      where: { userEmail_buffId: { userEmail: args.userEmail, buffId: args.buff.id } },
    });
    const duration = Math.min((existing?.duration ?? 0) + args.duration, ceiling);

    await tx.userBuff.upsert({
      where: { userEmail_buffId: { userEmail: args.userEmail, buffId: args.buff.id } },
      create: { userEmail: args.userEmail, buffId: args.buff.id, duration },
      update: { duration },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return duration;
  }

  async decreaseUserBuffs(args: { userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx ?? this.prisma;
    await tx.userBuff.updateMany({
      where: { userEmail: args.userEmail },
      data: { duration: { decrement: 1 } },
    });
    await tx.userBuff.deleteMany({
      where: { userEmail: args.userEmail, duration: { lte: 0 } },
    });
    return true;
  }

  /** Adds `amount` (negative to remove) while keeping the vital within 0..max. */
  private async _adjustVital(args: {
    userEmail: string;
    vital: 'health' | 'mana';
    amount: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const currentStats = await tx.stats.findUnique({ where: { userEmail: args.userEmail } });
    if (!currentStats) return undefined;

    const max = args.vital === 'health' ? currentStats.maxHealth : currentStats.maxMana;
    const final = clampVital({ current: currentStats[args.vital], amount: args.amount, max });

    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: { [args.vital]: { set: final } },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  private async _applyStats(
    args: StatChanges & { userEmail: string; tx?: TransactionContext },
    direction: 'increment' | 'decrement',
  ) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: statDelta(args, direction),
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  /** A level is worth one copy of the class's per-level stat block. */
  private async _applyLevels(args: {
    userEmail: string;
    amount: number;
    direction: 'increment' | 'decrement';
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const user = await tx.user.findUnique({
      where: { email: args.userEmail },
      include: { class: true },
    });
    const { class: userClass } = user;
    const gain = {
      userEmail: args.userEmail,
      level: args.amount,
      health: userClass.health * args.amount,
      mana: userClass.mana * args.amount,
      attack: userClass.attack * args.amount,
      str: userClass.str * args.amount,
      agi: userClass.agi * args.amount,
      int: userClass.int * args.amount,
      defense: userClass.defense * args.amount,
      tx,
    };
    return this._applyStats(gain, args.direction);
  }
}
