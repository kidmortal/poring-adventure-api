import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';

/**
 * The hiring board. A crafter publishes one offer — a price per stamina point
 * and which services they sell — and only published crafters are listed, so the
 * board is a list of people actually willing to work, not of every player.
 */
@Injectable()
export class ServiceOfferService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly logger = new Logger('Service offers');

  /**
   * Everyone currently offering. The crafter's stamina and profession level ride
   * along because both decide whether they can take a job at all.
   */
  getAllOffers() {
    return this.prisma.serviceOffer.findMany({
      include: this._offerInclude(),
      orderBy: { pricePerStamina: 'asc' },
    });
  }

  getUserOffer(args: { crafterEmail: string }) {
    return this.prisma.serviceOffer.findUnique({
      where: { crafterEmail: args.crafterEmail },
      include: this._offerInclude(),
    });
  }

  /**
   * Publishes or updates the crafter's own offer. The profession is not a
   * parameter: it is whichever one they currently practice, so swapping trade
   * republishes the offer under the new one.
   */
  async publishOffer(args: { crafterEmail: string; pricePerStamina: number; crafting: boolean; enhancing: boolean }) {
    if (args.pricePerStamina < 1) {
      throw new BadRequestException('Price per stamina must be at least 1 silver');
    }
    if (!args.crafting && !args.enhancing) {
      throw new BadRequestException('Offer at least one service');
    }

    const learned = await this.prisma.userProfession.findFirst({
      where: { userEmail: args.crafterEmail },
      include: { profession: true },
    });
    if (!learned) {
      throw new BadRequestException('You have not learned a profession');
    }
    // Gathering is done at a node, on your own: there is no job someone else
    // could pay you to do.
    if (learned.profession.kind !== 'crafting') {
      throw new BadRequestException(`${learned.profession.name} cannot be hired out`);
    }
    if (args.enhancing && !learned.profession.canEnhance) {
      throw new BadRequestException(`${learned.profession.name} cannot enhance items for others`);
    }

    this.logger.debug(`${args.crafterEmail} offers ${learned.profession.name} at ${args.pricePerStamina}/stamina`);
    return this.prisma.serviceOffer.upsert({
      where: { crafterEmail: args.crafterEmail },
      create: {
        crafterEmail: args.crafterEmail,
        professionId: learned.professionId,
        pricePerStamina: args.pricePerStamina,
        crafting: args.crafting,
        enhancing: args.enhancing,
      },
      update: {
        professionId: learned.professionId,
        pricePerStamina: args.pricePerStamina,
        crafting: args.crafting,
        enhancing: args.enhancing,
      },
    });
  }

  async removeOffer(args: { crafterEmail: string }) {
    await this.prisma.serviceOffer.deleteMany({ where: { crafterEmail: args.crafterEmail } });
    return true;
  }

  /**
   * The offer a hirer is trying to use, checked for the service they want. Both
   * hired jobs start here, so the "is this crafter actually selling this?"
   * question has a single answer.
   */
  async requireOffer(args: { offerId: number; service: 'crafting' | 'enhancing'; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    const offer = await tx.serviceOffer.findUnique({
      where: { id: args.offerId },
      include: this._offerInclude(),
    });

    if (!offer) {
      throw new BadRequestException('This crafter is not offering their services');
    }
    if (!offer[args.service]) {
      throw new BadRequestException(`${offer.crafter.name} does not offer that service`);
    }
    return offer;
  }

  private _offerInclude() {
    return {
      profession: true,
      crafter: {
        select: {
          name: true,
          email: true,
          stats: { select: { stamina: true, maxStamina: true } },
          professions: { select: { professionId: true, level: true } },
        },
      },
    } as const;
  }
}
