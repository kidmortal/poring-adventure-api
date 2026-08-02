import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';

export type FullUser = Prisma.UserGetPayload<{
  include: {
    appearance: true;
    inventory: { include: { item: true; marketListing: true } };
    class: { include: { skills: true } };
    professions: { include: { profession: true } };
    learnedSkills: { include: { skill: { include: { buff: true } } } };
    buffs: { include: { buff: true } };
    guildMember: true;
    guildApplications: true;
    stats: true;
  };
}>;

const USERS_PER_PAGE = 10;

/**
 * Every cached read of a user lives here, so there is exactly one place that
 * knows the cache keys and one place to invalidate them.
 */
@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly logger = new Logger('Cache - Users');

  async getFullUser(args: { userEmail: string }): Promise<FullUser> {
    if (!args.userEmail) {
      throw new BadRequestException('No email provided');
    }
    return this._cached(`user_${args.userEmail}`, () =>
      this.prisma.user.findUnique({
        where: { email: args.userEmail },
        include: {
          appearance: true,
          inventory: { include: { item: true, marketListing: true } },
          class: { include: { skills: true } },
          professions: { include: { profession: true } },
          learnedSkills: { include: { skill: { include: { buff: true } } } },
          buffs: { include: { buff: true } },
          guildMember: true,
          // Their own pending applications, so a guild they have asked to join
          // can say so instead of offering to apply again.
          guildApplications: true,
          stats: true,
        },
      }),
    );
  }

  /**
   * The ranking page. It carries enough to render another player's profile —
   * class, trade and worn gear — so opening one costs no extra round trip.
   */
  getUsersPage(args: { page: number }) {
    return this._cached(`users_page_${args.page}`, () =>
      this.prisma.user.findMany({
        skip: (args.page - 1) * USERS_PER_PAGE,
        take: USERS_PER_PAGE,
        orderBy: { stats: { experience: 'desc' } },
        include: {
          appearance: true,
          stats: true,
          class: true,
          professions: { include: { profession: true } },
          // Only what is worn: the rest of the inventory is nobody's business.
          inventory: { where: { equipped: true }, include: { item: true } },
        },
      }),
    );
  }

  getUserCount() {
    return this._cached('user_count', () => this.prisma.user.count());
  }

  async isAdmin(args: { adminEmail: string }) {
    if (!args.adminEmail) {
      throw new BadRequestException('No email provided');
    }
    const cacheKey = `user_admin_info_${args.adminEmail}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cached;
    }
    const user = await this.prisma.user.findUnique({ where: { email: args.adminEmail } });
    if (user?.admin) {
      await this.cache.set(cacheKey, true);
    }
    return user?.admin ?? false;
  }

  async clearUserCache(args: { email: string }) {
    const cacheKey = `user_${args.email}`;
    this.logger.debug(`clearing ${cacheKey}`);
    await this.cache.del(cacheKey);
  }

  private async _cached<T>(cacheKey: string, load: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(cacheKey);
    if (cached) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cached;
    }
    const value = await load();
    await this.cache.set(cacheKey, value);
    return value;
  }
}
