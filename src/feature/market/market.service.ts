import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { ItemsService } from 'src/feature/items/items.service';
import { UsersService } from 'src/feature/users/users.service';
import { WebsocketService } from 'src/core/websocket/websocket.service';
import { TransactionContext } from 'src/core/prisma/types/prisma';
import { ItemCategory } from 'src/feature/items/constants';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EQUIPABLE_CATEGORIES } from 'src/feature/items/entities/categories';

@Injectable()
export class MarketService {
  constructor(
    private readonly itemService: ItemsService,
    private readonly userService: UsersService,
    private readonly websocket: WebsocketService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}
  private logger = new Logger('Cache - market');
  async addItemToMarket(args: { price: number; stack: number; itemId: number; sellerEmail: string }) {
    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          itemId: args.itemId,
          userEmail: args.sellerEmail,
        },
      },
      include: {
        marketListing: true,
        item: true,
      },
    });

    if (!inventoryItem) {
      throw new BadRequestException(`No item found with id ${args.itemId} on ${args.sellerEmail} inventory`);
    }

    if (inventoryItem.stack < args.stack) {
      throw new BadRequestException(`You only have ${inventoryItem.stack}, but trying to sell ${args.stack}`);
    }

    if (inventoryItem.marketListing) {
      const remainingStock = inventoryItem.stack - inventoryItem.marketListing.stack;

      if (args.stack > remainingStock) {
        this.websocket.sendErrorNotification({
          email: args.sellerEmail,
          text: `You only have ${remainingStock}, but trying to post ${args.stack} stacks`,
        });
        return false;
      }
      if (args.price !== inventoryItem.marketListing.price) {
        this.websocket.sendErrorNotification({
          email: args.sellerEmail,
          text: `Item already listed for ${inventoryItem.marketListing.price} silver, you cant post again with different price`,
        });
        return false;
      }
    }

    await this._createOrIncrementMarketListing({
      price: args.price,
      stack: args.stack,
      currentStacks: inventoryItem.stack,
      inventoryId: inventoryItem.id,
      sellerEmail: args.sellerEmail,
    });
    this.websocket.sendTextNotification({
      email: args.sellerEmail,
      text: `Listed ${args.stack}x ${inventoryItem.item.name} on Market!`,
    });
    const category = inventoryItem.item.category as ItemCategory;
    this._clearSelectedCache({ clear: ['all', category] });
    return true;
  }

  async purchase(args: { marketListingId: number; stacks: number; buyerEmail: string }) {
    await this.prisma.$transaction(async (tx) => {
      const purchasingUser = await tx.user.findUnique({
        where: { email: args.buyerEmail },
      });
      if (!purchasingUser) {
        throw new BadRequestException('User not registered');
      }
      const marketListing = await tx.marketListing.findUnique({
        where: { id: args.marketListingId },
        include: { inventory: { include: { item: true } } },
      });
      if (!marketListing) {
        throw new BadRequestException('Listing not found');
      }
      const purchaseTotalPrice = marketListing.price * args.stacks;
      if (purchasingUser.silver < purchaseTotalPrice) {
        throw new BadRequestException('You are too poor for that');
      }

      await this._decrementOrRemoveMarketListing({
        marketListingId: marketListing.id,
        currentStacks: marketListing.stack,
        decrementStacks: args.stacks,
        tx,
      });

      await this.userService.transferSilverFromUserToUser({
        senderEmail: purchasingUser.email,
        receiverEmail: marketListing.sellerEmail,
        amount: purchaseTotalPrice,
        tx,
      });
      await this.itemService.transferItemFromUserToUser({
        senderEmail: marketListing.sellerEmail,
        receiverEmail: purchasingUser.email,
        itemId: marketListing.inventory.itemId,
        stack: args.stacks,
        tx,
      });
      const category = marketListing.inventory?.item?.category as ItemCategory;
      this._clearSelectedCache({ clear: ['all', category] });
      return true;
    });

    return false;
  }

  async findAll(params: { page: number; category: ItemCategory }) {
    const listings = await this._getMarketListings(params);
    const count = await this._marketListingsCount();
    return { listings, count };
  }

  findOne(id: number) {
    return `This action returns a #${id} market`;
  }

  async remove(args: { marketListingId: number; userEmail: string }) {
    const marketListing = await this.prisma.marketListing.findUnique({
      where: { id: args.marketListingId },
    });

    if (!marketListing) {
      throw new BadRequestException('Listing not found');
    }

    if (marketListing?.sellerEmail !== args.userEmail) {
      throw new UnauthorizedException(
        `You are signed as ${args.userEmail}, but the listing number ${args.marketListingId} was made by ${marketListing.sellerEmail}`,
      );
    }

    try {
      const deletedItem = await this.prisma.marketListing.delete({
        where: { id: args.marketListingId },
        include: { inventory: { include: { item: true } } },
      });
      const category = deletedItem.inventory?.item?.category as ItemCategory;
      this.websocket.sendTextNotification({
        email: args.userEmail,
        text: `Removed ${deletedItem.stack}x ${deletedItem.inventory.item.name} from Market!`,
      });
      this._clearSelectedCache({ clear: ['all', category] });
      return deletedItem;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  private async _getMarketListings(params: { page: number; category: ItemCategory }) {
    const cacheKey = `market_listing_${params.category}_${params.page}`;
    const cachedMarketListing = await this.cache.get(cacheKey);
    if (cachedMarketListing) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cachedMarketListing as any;
    }

    const query = {
      skip: (params.page - 1) * 10,
      take: 10,
      where: {},
      include: { inventory: { include: { item: true } }, seller: true },
    };
    switch (params.category) {
      case 'all':
        query.where = {};
        break;
      case 'equipment':
        query.where = {
          inventory: { item: { category: { in: EQUIPABLE_CATEGORIES } } },
        };
        break;

      default:
        query.where = {
          inventory: { item: { category: { equals: params.category } } },
        };
        break;
    }
    const listings = await this.prisma.marketListing.findMany(query);
    this.cache.set(cacheKey, listings);
    return listings;
  }
  private async _marketListingsCount() {
    const cacheKey = `market_listing_count`;
    const cachedCount = await this.cache.get(cacheKey);
    if (cachedCount) {
      this.logger.log(`returning cached ${cacheKey}`);
      return cachedCount as any;
    }
    const count = await this.prisma.marketListing.count();
    this.cache.set(cacheKey, count);
    return count;
  }

  private async _createOrIncrementMarketListing(args: {
    price: number;
    stack: number;
    currentStacks: number;
    inventoryId: number;
    sellerEmail: string;
  }) {
    return this.prisma.marketListing.upsert({
      where: {
        sellerEmail: args.sellerEmail,
        inventoryId: args.inventoryId,
      },
      create: {
        price: args.price,
        stack: args.stack,
        seller: {
          connect: {
            email: args.sellerEmail,
          },
        },
        inventory: {
          connect: {
            id: args.inventoryId,
          },
        },
      },
      update: {
        stack: {
          increment: args.stack,
        },
      },
    });
  }

  private async _decrementOrRemoveMarketListing(args: {
    marketListingId: number;
    currentStacks: number;
    decrementStacks: number;
    tx?: TransactionContext;
  }) {
    const tx = args.tx || this.prisma;
    if (args.decrementStacks < args.currentStacks) {
      return await tx.marketListing.update({
        where: {
          id: args.marketListingId,
        },
        data: {
          stack: {
            decrement: args.decrementStacks,
          },
        },
      });
    }
    if (args.decrementStacks === args.currentStacks) {
      return await tx.marketListing.delete({
        where: {
          id: args.marketListingId,
        },
      });
    }
    throw new BadRequestException(
      `Invalid decrement has been provided, you cant remove ${args.decrementStacks} from ${args.currentStacks}`,
    );
  }

  private async _clearSelectedCache(params: { clear: ItemCategory[] }) {
    const keys = await this.cache.store.keys();

    keys.forEach((key) => {
      params.clear.forEach((categoryKey) => {
        const cacheKey = `market_listing_${categoryKey}`;
        if (key.includes(cacheKey)) this.cache.del(key);
      });
    });
    this._clearCountCache();
  }
  private async _clearCountCache() {
    const cacheKey = `market_listing_count`;
    this.cache.del(cacheKey);
  }
}
