import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { UsersRepository } from './users.repository';

/** Silver and experience — the two currencies stored on the user row. */
@Injectable()
export class UserWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: UsersRepository,
  ) {}

  addSilverToUser(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._updateSilver({ ...args, amount: args.amount });
  }

  removeSilverFromUser(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    return this._updateSilver({ ...args, amount: -args.amount });
  }

  async transferSilverFromUserToUser(args: {
    senderEmail: string;
    receiverEmail: string;
    amount: number;
    tx?: TransactionContext;
  }) {
    await this.removeSilverFromUser({ userEmail: args.senderEmail, amount: args.amount, tx: args.tx });
    return this.addSilverToUser({ userEmail: args.receiverEmail, amount: args.amount, tx: args.tx });
  }

  async addExpToUser(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: { experience: { increment: args.amount } },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  async addExpSilver(args: { userEmail: string; exp: number; silver: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    await tx.user.update({
      where: { email: args.userEmail },
      data: {
        silver: { increment: args.silver },
        stats: { update: { experience: { increment: args.exp } } },
      },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  private async _updateSilver(args: { userEmail: string; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    await tx.user.update({
      where: { email: args.userEmail },
      data: { silver: { increment: args.amount } },
    });
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }
}
