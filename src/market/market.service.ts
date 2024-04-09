import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateMarketDto } from './dto/create-market.dto';
// import { UpdateMarketDto } from './dto/update-market.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ItemsService } from 'src/items/items.service';
import { UsersService } from 'src/users/users.service';
import { WebsocketService } from 'src/websocket/websocket.service';
import { TransactionContext } from 'src/prisma/types/prisma';
import { ItemCategory } from 'src/items/constants';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EQUIPABLE_CATEGORIES } from 'src/items/entities/categories';

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
  async addItemToMarket(createMarketDto: CreateMarketDto, sellerEmail: string) {
    const inventoryItem = await this.prisma.inventoryItem.findUnique({
      where: {
        userEmail_itemId: {
          itemId: createMarketDto.itemId,
          userEmail: sellerEmail,
        },
      },
      include: {
        marketListing: true,
        item: true,
      },
    });

    if (!inventoryItem) {
      throw new BadRequestException(
        `No item found with id ${createMarketDto.itemId} on ${sellerEmail} inventory`,
      );
    }

    if (inventoryItem.stack < createMarketDto.stack) {
      throw new BadRequestException(
        `You only have ${inventoryItem.stack}, but trying to sell ${createMarketDto.stack}`,
      );
    }

    if (inventoryItem.marketListing) {
      const remainingStock =
        inventoryItem.stack - inventoryItem.marketListing.stack;

      if (createMarketDto.stack > remainingStock) {
        throw new BadRequestException(
          `You only have ${remainingStock}, but trying to post ${createMarketDto.stack} stacks`,
        );
      }
    }

    await this._createOrIncrementMarketListing({
      price: createMarketDto.price,
      stack: createMarketDto.stack,
      currentStacks: inventoryItem.stack,
      inventoryId: inventoryItem.id,
      sellerEmail,
    });
    const category = inventoryItem.item.category as ItemCategory;
    this._clearSelectedCache({ clear: ['all', category] });
    return true;
  }

  async purchase(args: {
    marketListingId: number;
    buyerEmail: string;
    stacks: number;
  }) {
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
    return listings;
  }

  findOne(id: number) {
    return `This action returns a #${id} market`;
  }

  async remove(id: number, authEmail: string) {
    const marketListing = await this.prisma.marketListing.findUnique({
      where: { id },
    });

    if (!marketListing) {
      throw new BadRequestException('Listing not found');
    }

    if (marketListing?.sellerEmail !== authEmail) {
      throw new UnauthorizedException(
        `You are signed as ${authEmail}, but the listing number ${id} was made by ${marketListing.sellerEmail}`,
      );
    }

    try {
      const deletedItem = await this.prisma.marketListing.delete({
        where: { id },
        include: { inventory: { include: { item: true } } },
      });
      const category = deletedItem.inventory?.item?.category as ItemCategory;
      this._clearSelectedCache({ clear: ['all', category] });
      return deletedItem;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  private async _getMarketListings(params: {
    page: number;
    category: ItemCategory;
  }) {
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
  }
}
