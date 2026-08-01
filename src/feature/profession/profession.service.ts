import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { UsersRepository } from 'src/feature/users/users.repository';
import { Utils } from 'src/utilities/utils';

/**
 * The crafting and gathering trades. A profession is learned once and then
 * levels on its own, independently of the combat class and of the other
 * professions — mining never advances cooking.
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

  async learnProfession(args: { userEmail: string; professionId: number }) {
    const profession = await this.prisma.profession.findUnique({ where: { id: args.professionId } });
    if (!profession) {
      throw new BadRequestException('Profession does not exist');
    }

    const existing = await this.prisma.userProfession.findUnique({
      where: { userEmail_professionId: { userEmail: args.userEmail, professionId: args.professionId } },
    });
    if (existing) {
      throw new BadRequestException('Profession already learned');
    }

    this.logger.debug(`${args.userEmail} learned ${profession.name}`);
    await this.prisma.userProfession.create({
      data: { userEmail: args.userEmail, professionId: args.professionId },
    });
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
    await this.repository.clearUserCache({ email: args.userEmail });
    return true;
  }

  private _recipeInclude() {
    return { include: { item: true, ingredients: { include: { item: true } } } } as const;
  }
}
