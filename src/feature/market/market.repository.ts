import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { ItemCategory } from 'src/feature/items/constants';
import { EQUIPABLE_CATEGORIES } from 'src/feature/items/entities/categories';
import { ITEM_WITH_BUFF } from 'src/feature/items/entities/itemInclude';

const LISTINGS_PER_PAGE = 10;
const COUNT_CACHE_KEY = 'market_listing_count';

/** Market listing reads, writes and their cache. */
@Injectable()
export class MarketRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}
  private readonly logger = new Logger('Cache - market');

  async getListings(args: { page: number; category: ItemCategory }) {
    const cacheKey = `market_listing_${args.category}_${args.page}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cached;
    }

    const listings = await this.prisma.marketListing.findMany({
      skip: (args.page - 1) * LISTINGS_PER_PAGE,
      take: LISTINGS_PER_PAGE,
      where: this._categoryFilter(args.category),
      include: { inventory: { include: { item: ITEM_WITH_BUFF } }, seller: true },
    });
    await this.cache.set(cacheKey, listings);
    return listings;
  }

  async countListings() {
    const cached = await this.cache.get(COUNT_CACHE_KEY);
    if (cached) {
      this.logger.log(`returning cached ${COUNT_CACHE_KEY}`);
      return cached;
    }
    const count = await this.prisma.marketListing.count();
    await this.cache.set(COUNT_CACHE_KEY, count);
    return count;
  }

  getListing(args: { marketListingId: number; tx?: TransactionContext }) {
    const tx = args.tx || this.prisma;
    return tx.marketListing.findUnique({
      where: { id: args.marketListingId },
      include: { inventory: { include: { item: ITEM_WITH_BUFF } } },
    });
  }

  createOrIncrementListing(args: {
    price: number;
    stack: number;
    inventoryId: number;
    sellerEmail: string;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    return tx.marketListing.upsert({
      where: { sellerEmail: args.sellerEmail, inventoryId: args.inventoryId },
      create: {
        price: args.price,
        stack: args.stack,
        seller: { connect: { email: args.sellerEmail } },
        inventory: { connect: { id: args.inventoryId } },
      },
      update: { stack: { increment: args.stack } },
    });
  }

  /** Takes stacks off a listing, deleting it once it is emptied. */
  decrementOrRemoveListing(args: {
    marketListingId: number;
    currentStacks: number;
    decrementStacks: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    if (args.decrementStacks > args.currentStacks) {
      throw new BadRequestException(
        `Invalid decrement has been provided, you cant remove ${args.decrementStacks} from ${args.currentStacks}`,
      );
    }
    if (args.decrementStacks === args.currentStacks) {
      return tx.marketListing.delete({ where: { id: args.marketListingId } });
    }
    return tx.marketListing.update({
      where: { id: args.marketListingId },
      data: { stack: { decrement: args.decrementStacks } },
    });
  }

  deleteListing(args: { marketListingId: number }) {
    return this.prisma.marketListing.delete({
      where: { id: args.marketListingId },
      include: { inventory: { include: { item: ITEM_WITH_BUFF } } },
    });
  }

  /** Drops every cached page of the given categories, plus the total count. */
  async clearCache(args: { categories: ItemCategory[] }) {
    const keys = await this.cache.store.keys();
    await Promise.all(
      keys
        .filter((key) => args.categories.some((category) => key.includes(`market_listing_${category}`)))
        .map((key) => this.cache.del(key)),
    );
    await this.cache.del(COUNT_CACHE_KEY);
  }

  private _categoryFilter(category: ItemCategory) {
    if (category === 'all') return {};
    if (category === 'equipment') {
      return { inventory: { item: { category: { in: EQUIPABLE_CATEGORIES } } } };
    }
    return { inventory: { item: { category: { equals: category } } } };
  }
}
