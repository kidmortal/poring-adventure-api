import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { UserWithStats } from 'src/feature/battle/battle';
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

  increaseUserLevel(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._applyLevels({ ...args, direction: 'increment' });
  }

  decreaseUserLevel(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._applyLevels({ ...args, direction: 'decrement' });
  }

  /** Brings the user's level in line with their experience, in either direction. */
  async levelUpUser({ user, expGain, ...args }: { user: UserWithStats; expGain: number; tx?: TransactionContext }) {
    const currentLevel = user.stats.level;
    const correctLevel = Utils.getLevelFromExp(user.stats.experience + expGain);
    if (correctLevel === currentLevel) return false;

    const amount = Math.abs(correctLevel - currentLevel);
    await this._applyLevels({
      userEmail: user.email,
      amount,
      direction: correctLevel > currentLevel ? 'increment' : 'decrement',
      tx: args.tx,
    });
    return true;
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
      tx,
    };
    return this._applyStats(gain, args.direction);
  }
}
