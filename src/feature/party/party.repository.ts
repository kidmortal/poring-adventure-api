import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';

export type FullParty = Prisma.PartyGetPayload<{
  include: {
    members: {
      include: {
        stats: true;
        appearance: true;
        class: true;
        learnedSkills: { include: { skill: true } };
        buffs: { include: { buff: true } };
      };
    };
  };
}>;

/** Cached party reads and the membership writes behind them. */
@Injectable()
export class PartyRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly logger = new Logger('Cache - party');

  async getPartyFromId(args: { partyId?: number }): Promise<FullParty> {
    if (!args.partyId) return null;

    const cacheKey = this._key(args.partyId);
    const cached = await this.cache.get<FullParty>(cacheKey);
    if (cached) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cached;
    }

    const party = await this.prisma.party.findFirst({
      where: { id: args.partyId },
      include: {
        members: {
          include: {
            stats: true,
            appearance: true,
            class: true,
            learnedSkills: { include: { skill: true } },
            buffs: { include: { buff: true } },
          },
        },
      },
    });
    await this.cache.set(cacheKey, party);
    return party;
  }

  async userHasParty(args: { email?: string }) {
    if (!args.email) return false;
    const userParty = await this.prisma.party.findFirst({
      where: { members: { some: { email: args.email } } },
    });
    return !!userParty;
  }

  createParty(args: { email: string }) {
    return this.prisma.party.create({
      data: { leaderEmail: args.email, members: { connect: { email: args.email } } },
    });
  }

  deletePartyOwnedBy(args: { email: string }) {
    return this.prisma.party.delete({ where: { leaderEmail: args.email } });
  }

  /** Joins (`partyId`) or leaves (`null`); the caller says which cache to drop. */
  setUserParty(args: { email: string; partyId: number | null }) {
    return this.prisma.user.update({
      where: { email: args.email },
      data: { partyId: args.partyId },
    });
  }

  async clearPartyCache(args: { partyId?: number }) {
    if (!args.partyId) return;
    const cacheKey = this._key(args.partyId);
    await this.cache.del(cacheKey);
    this.logger.log(`cache cleared ${cacheKey}`);
  }

  private _key(partyId: number) {
    return `party_id_${partyId}`;
  }
}
