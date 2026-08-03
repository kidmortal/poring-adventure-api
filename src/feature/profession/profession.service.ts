import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { UsersRepository } from 'src/feature/users/users.repository';
import { Utils } from 'src/utilities/utils';
import { maxStaminaForProfession } from './profession.rules';

/**
 * The crafting and gathering trades. A player commits to exactly one profession
 * at a time: it levels on its own, independently of the combat class, and
 * swapping to another one abandons the current one's level for good.
 */
@Injectable()
export class ProfessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: UsersRepository,
  ) {}
  private readonly logger = new Logger('Professions');

  getAllProfessions() {
    return this.prisma.profession.findMany({
      include: { nodes: { include: { drops: { include: { item: true } } } }, recipes: this._recipeInclude() },
      orderBy: { id: 'asc' },
    });
  }

  getUserProfessions(args: { userEmail: string }) {
    return this.prisma.userProfession.findMany({
      where: { userEmail: args.userEmail },
      include: { profession: true },
      orderBy: { learnedAt: 'asc' },
    });
  }

  /** The one profession the player currently practices, or null while undecided. */
  getUserProfession(args: { userEmail: string }) {
    return this.prisma.userProfession.findFirst({
      where: { userEmail: args.userEmail },
      include: { profession: true },
    });
  }

  /**
   * Learns a profession, or swaps to it. A player only ever holds one, so
   * swapping drops the current one entirely — its level and experience are gone
   * and coming back later means starting over at level 1.
   */
  async learnProfession(args: { userEmail: string; professionId: number }) {
    const profession = await this.prisma.profession.findUnique({ where: { id: args.professionId } });
    if (!profession) {
      throw new BadRequestException('Profession does not exist');
    }

    const current = await this.getUserProfession({ userEmail: args.userEmail });
    if (current?.professionId === args.professionId) {
      throw new BadRequestException('Profession already learned');
    }

    await this.prisma.$transaction(async (tx) => {
      if (current) {
        this.logger.debug(`${args.userEmail} abandoned ${current.profession.name} at level ${current.level}`);
        await tx.userProfession.deleteMany({ where: { userEmail: args.userEmail } });
      }
      await tx.userProfession.create({
        data: { userEmail: args.userEmail, professionId: args.professionId },
      });
      // Starting over at level 1 takes the earned stamina back with it.
      await this._syncMaxStamina({ userEmail: args.userEmail, level: 1, tx });
    });

    this.logger.debug(`${args.userEmail} learned ${profession.name}`);
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  /**
   * Both gathering and crafting go through here: an action is only allowed when
   * its profession is learned and levelled far enough for it.
   */
  async requireLearnedProfession(args: {
    userEmail: string;
    professionId: number;
    requiredLevel: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    const learned = await tx.userProfession.findUnique({
      where: { userEmail_professionId: { userEmail: args.userEmail, professionId: args.professionId } },
      include: { profession: true },
    });

    if (!learned) {
      throw new BadRequestException('You have not learned this profession');
    }
    if (learned.level < args.requiredLevel) {
      throw new BadRequestException(`Requires ${learned.profession.name} level ${args.requiredLevel}`);
    }
    return learned;
  }

  /** Credits experience to one profession and re-derives its level from it. */
  async addExperience(args: { userEmail: string; professionId: number; amount: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const learned = await tx.userProfession.findUnique({
      where: { userEmail_professionId: { userEmail: args.userEmail, professionId: args.professionId } },
    });
    if (!learned) return false;

    const experience = learned.experience + args.amount;
    const level = Utils.getLevelFromExp(experience);
    if (level > learned.level) {
      this.logger.debug(`${args.userEmail} reached profession level ${level}`);
    }

    await tx.userProfession.update({
      where: { id: learned.id },
      data: { experience, level },
    });
    if (level !== learned.level) {
      await this._syncMaxStamina({ userEmail: args.userEmail, level, tx });
    }
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  /**
   * Brings the daily budget in line with the trade's level.
   *
   * Only the ceiling moves — the current bar is left where it is, so levelling
   * up mid-afternoon does not hand out a free refill, and dropping a profession
   * cannot leave a player standing above their own maximum.
   */
  private async _syncMaxStamina(args: { userEmail: string; level: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const maxStamina = maxStaminaForProfession({ level: args.level });
    const stats = await tx.stats.findUnique({ where: { userEmail: args.userEmail } });
    if (!stats || stats.maxStamina === maxStamina) return false;

    await tx.stats.update({
      where: { userEmail: args.userEmail },
      data: { maxStamina, stamina: Math.min(stats.stamina, maxStamina) },
    });
    return true;
  }

  private _recipeInclude() {
    return { include: { item: true, ingredients: { include: { item: true } } } } as const;
  }
}
