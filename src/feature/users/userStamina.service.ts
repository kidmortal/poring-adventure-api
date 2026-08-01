import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { UsersRepository } from './users.repository';
import { isNewDay } from './users.rules';

/**
 * Stamina is the daily activity budget. There is no ticking timer: the refill
 * is lazy, checked whenever the user is read or spends stamina, so a player who
 * was offline for a week still comes back to a full bar and nothing needs to
 * run while the server is idle.
 */
@Injectable()
export class UserStaminaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: UsersRepository,
  ) {}
  private readonly logger = new Logger('Stamina');

  /** Tops the bar up when the stored refill date is not today. */
  async refillIfNewDay(args: { userEmail: string; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const stats = await tx.stats.findUnique({ where: { userEmail: args.userEmail } });
    if (!stats) return false;
    if (!isNewDay(stats.staminaRefilledAt, new Date())) return false;

    this.logger.debug(`refilling stamina for ${args.userEmail}`);
    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: { stamina: stats.maxStamina, staminaRefilledAt: new Date() },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  /** Spends stamina, refilling first so a new day's budget is available. */
  async consumeStamina(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    await this.refillIfNewDay({ userEmail: args.userEmail, tx });

    const stats = await tx.stats.findUnique({ where: { userEmail: args.userEmail } });
    if (!stats) return false;
    if (stats.stamina < args.amount) {
      throw new BadRequestException('Not enough stamina');
    }

    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: { stamina: { decrement: args.amount } },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  async addStamina(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const stats = await tx.stats.findUnique({ where: { userEmail: args.userEmail } });
    if (!stats) return false;

    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: { stamina: Math.min(stats.stamina + args.amount, stats.maxStamina) },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }
}
